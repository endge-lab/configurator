import type {
  ExtractableSFCColumn,
  ExtractColumnCommandTarget,
  ExtractComponentDialogInput,
  ExtractComponentDialogResult,
} from './extract-component.types'
import type { RComponentSFCEditor } from '@/features/endge-ide/domain/entities/RComponentSFCEditor'
import type { ScriptEditorExtension } from '@/features/endge-ide/source-editor/adapters/monaco/script-editor-extension.types'
/* eslint-disable style/max-statements-per-line */
import type { RComponentSFC } from '@endge/core'
import type * as Monaco from 'monaco-editor'

import {
  ComponentType,
  DocumentDraftFactory,
  Endge,
  isComponentSFCBuiltInTag,
} from '@endge/core'
import { defineAsyncComponent } from 'vue'
import { toast } from 'vue-sonner'

import { runBusy } from '@/features/endge-ide/model/core/endge-ide-busy'
import {
  openSourceEditorDialog,
  registerSourceEditorDialog,
} from '@/features/endge-ide/source-editor/core/source-editor-dialogs'

import {
  buildExtractedComponentSource,
  replaceExtractedColumnBody,
} from './extract-component.transform'

const DIALOG_ID = 'component-sfc.extract-component'
let contributionSequence = 0

registerSourceEditorDialog({
  id: DIALOG_ID,
  component: defineAsyncComponent(() => import('./ExtractComponent_Dialog.vue')),
})

export interface ExtractComponentContributionOptions {
  getEditorModel: () => RComponentSFCEditor | null
  getPersistedModel: () => RComponentSFC | null
}

export function createExtractComponentContribution(
  options: ExtractComponentContributionOptions,
): ScriptEditorExtension {
  const instanceId = ++contributionSequence

  return {
    id: `${DIALOG_ID}.${instanceId}`,
    install: ({ monaco, editor, model }) => {
      const commandId = `${DIALOG_ID}.command.${instanceId}`
      let cachedVersion = -1
      let cachedColumns: ExtractableSFCColumn[] = []
      const action = editor.addAction({
        id: commandId,
        label: 'Экспорт компонента',
        run: async (_editor, target?: ExtractColumnCommandTarget) => {
          if (!target) { return }
          await openExtractDialog(model, target, options)
        },
      })

      const provider = monaco.languages.registerInlayHintsProvider(model.getLanguageId(), {
        displayName: 'SFC Column actions',
        async provideInlayHints(candidateModel, visibleRange) {
          if (candidateModel !== model) { return { hints: [], dispose() {} } }

          const { analyzeExtractableSFCColumns } = await import('./extract-component.analysis')
          const currentVersion = candidateModel.getVersionId()
          if (cachedVersion !== currentVersion) {
            cachedColumns = analyzeExtractableSFCColumns(candidateModel.getValue())
            cachedVersion = currentVersion
          }

          const hints: Monaco.languages.InlayHint[] = cachedColumns
            .map((column) => {
              const position = candidateModel.getPositionAt(column.tagNameEnd)
              if (
                position.lineNumber < visibleRange.startLineNumber
                || position.lineNumber > visibleRange.endLineNumber
              ) { return null }

              return {
                position,
                kind: monaco.languages.InlayHintKind.Type,
                paddingLeft: true,
                paddingRight: false,
                label: [{
                  label: 'Экспорт компонента',
                  tooltip: 'Вынести разметку колонки в отдельный SFC-компонент',
                  command: {
                    id: commandId,
                    title: 'Экспорт компонента',
                    arguments: [{
                      columnStart: column.columnRange.start,
                      sourceVersion: candidateModel.getVersionId(),
                    } satisfies ExtractColumnCommandTarget],
                  },
                }],
              }
            })
            .filter((hint): hint is Monaco.languages.InlayHint => hint !== null)

          return { hints, dispose() {} }
        },
      })

      return {
        dispose() {
          provider.dispose()
          action.dispose()
        },
      }
    },
  }
}

async function openExtractDialog(
  model: Monaco.editor.ITextModel,
  target: ExtractColumnCommandTarget,
  options: ExtractComponentContributionOptions,
): Promise<void> {
  const editorModel = options.getEditorModel()
  const persistedModel = options.getPersistedModel()
  if (!editorModel || !persistedModel) { return }

  const source = model.getValue()
  const { resolveExtractableSFCColumn } = await import('./extract-component.analysis')
  const column = resolveExtractableSFCColumn(source, target.columnStart)
  if (!column) {
    toast.info('Колонка изменилась', { description: 'Запустите экспорт ещё раз.' })
    return
  }

  const suggestionBase = column.columnTitle || column.columnKey || 'Column'
  const suggestionKey = column.columnKey || toKebabCase(suggestionBase) || 'column'
  const input: ExtractComponentDialogInput = {
    parentIdentity: editorModel.identity,
    suggestedName: `${suggestionBase} — ячейка`,
    suggestedIdentity: `${editorModel.identity}-${suggestionKey}-cell`,
    suggestedTag: `${toPascalCase(suggestionBase)}Cell`,
    column,
  }

  const result = await openSourceEditorDialog<ExtractComponentDialogInput, ExtractComponentDialogResult>(DIALOG_ID, input)
  if (!result) { return }

  try {
    await runBusy(executeExtraction(model, column.columnRange.start, result, options))
    toast.success('Компонент создан', { description: result.identity })
  }
  catch (error) {
    toast.error('Не удалось экспортировать компонент', {
      description: error instanceof Error ? error.message : String(error),
    })
  }
}

async function executeExtraction(
  model: Monaco.editor.ITextModel,
  columnStart: number,
  result: ExtractComponentDialogResult,
  options: ExtractComponentContributionOptions,
): Promise<void> {
  const editorModel = options.getEditorModel()
  const persistedModel = options.getPersistedModel()
  if (!editorModel || !persistedModel) { throw new Error('Активный SFC-документ больше недоступен.') }

  validateComponentIdentityAndTag(result)

  const currentSource = model.getValue()
  const { resolveExtractableSFCColumn } = await import('./extract-component.analysis')
  const currentColumn = resolveExtractableSFCColumn(currentSource, columnStart)
  if (!currentColumn) { throw new Error('Колонка изменилась. Повторите экспорт компонента.') }

  const childSource = buildExtractedComponentSource(currentColumn, result.dependencies)
  const parentSource = replaceExtractedColumnBody(currentSource, currentColumn, result)
  const child = DocumentDraftFactory.create(ComponentType.SFC, {
    identity: result.identity,
    name: result.name,
    folderId: editorModel.folderId ?? undefined,
  }) as RComponentSFC

  child.tag = result.tag
  child.source = childSource
  child.project = editorModel.project ?? null

  const previousPersistedSource = persistedModel.source
  let childSaved = false

  try {
    await Endge.schema.saveDocument(result.identity, ComponentType.SFC, { model: child })
    childSaved = true

    model.setValue(parentSource)
    editorModel.source = parentSource
    editorModel.parseSource()
    editorModel.updateSource(persistedModel)
    await Endge.schema.saveDocument(editorModel.identity, ComponentType.SFC, { model: persistedModel })
  }
  catch (error) {
    model.setValue(currentSource)
    editorModel.source = currentSource
    editorModel.parseSource()
    persistedModel.source = previousPersistedSource

    if (childSaved) {
      try {
        await Endge.schema.deleteDocumentHard(result.identity, ComponentType.SFC)
        Endge.domain.removeComponentSFC(result.identity)
      }
      catch (rollbackError) {
        console.error('[extract-component] rollback failed', rollbackError)
      }
    }
    throw error
  }
}

function validateComponentIdentityAndTag(result: ExtractComponentDialogResult): void {
  if (!result.identity.trim()) { throw new Error('Identity компонента не указан.') }

  if (Endge.domain.hasComponentSFCByIdentity(result.identity)) { throw new Error(`SFC-компонент с identity "${result.identity}" уже существует.`) }

  const tag = result.tag?.trim() || null
  if (!tag) { return }

  if (!/^[A-Z_$][\w$-]*(?:\.[A-Z_$][\w$-]*)*$/i.test(tag)) { throw new Error(`Tag "${tag}" имеет недопустимый формат.`) }

  if (isComponentSFCBuiltInTag(tag)) { throw new Error(`Tag "${tag}" занят встроенным SFC primitive.`) }

  const owner = Endge.domain.getComponentSFCs().find(component => component.tag?.trim() === tag)
  if (owner) { throw new Error(`Tag "${tag}" уже используется компонентом "${owner.identity}".`) }
}

function toKebabCase(value: string): string {
  return value
    .trim()
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .replace(/[^A-Z\d]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function toPascalCase(value: string): string {
  const normalized = value
    .trim()
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .split(/[^A-Z\d]+/i)
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('')

  return normalized || 'Column'
}
