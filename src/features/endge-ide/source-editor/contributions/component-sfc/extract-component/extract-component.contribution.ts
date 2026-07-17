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

import { buildExtractComponentFolderOptions } from './extract-component.folders'
import {
  buildExtractedComponentSource,
  replaceExtractedColumnBody,
} from './extract-component.transform'

const DIALOG_ID = 'component-sfc.extract-component'
const ACTION_CLASS_NAME = 'endge-sfc-column-action'
const ACTION_DATA_KIND = 'endge.sfc-column.extract-component'
const ACTION_LABEL = 'Экспорт компонента'
let contributionSequence = 0

interface ExtractColumnActionData {
  kind: typeof ACTION_DATA_KIND
  target: ExtractColumnCommandTarget
}

interface MonacoInjectedTextMouseTarget {
  detail?: {
    injectedText?: {
      options?: {
        attachedData?: unknown
      }
    } | null
  }
}

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
      let disposed = false
      let refreshTimer: ReturnType<typeof setTimeout> | null = null
      let refreshSequence = 0
      const actionDisposable = editor.addAction({
        id: commandId,
        label: 'Экспорт компонента',
        run: async (_editor, target?: ExtractColumnCommandTarget) => {
          if (!target) { return }
          await openExtractDialog(model, target, options)
        },
      })
      const decorations = editor.createDecorationsCollection()

      const refreshDecorations = async (): Promise<void> => {
        const sequence = ++refreshSequence
        const sourceVersion = model.getVersionId()
        const { analyzeExtractableSFCColumns } = await import('./extract-component.analysis')
        if (disposed || sequence !== refreshSequence || sourceVersion !== model.getVersionId()) { return }

        const columns: ExtractableSFCColumn[] = analyzeExtractableSFCColumns(model.getValue())
        decorations.set(columns.map((column) => {
          const position = model.getPositionAt(column.actionAnchor)
          return {
            range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
            options: {
              description: 'SFC Column extract component action',
              showIfCollapsed: true,
              stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
              after: {
                content: ACTION_LABEL,
                inlineClassName: ACTION_CLASS_NAME,
                inlineClassNameAffectsLetterSpacing: true,
                cursorStops: monaco.editor.InjectedTextCursorStops.None,
                attachedData: {
                  kind: ACTION_DATA_KIND,
                  target: {
                    columnStart: column.columnRange.start,
                    sourceVersion,
                  },
                } satisfies ExtractColumnActionData,
              },
            },
          }
        }))
      }

      const scheduleRefresh = (): void => {
        if (refreshTimer) { clearTimeout(refreshTimer) }
        refreshTimer = setTimeout(() => {
          refreshTimer = null
          void refreshDecorations()
        }, 80)
      }

      const contentListener = model.onDidChangeContent(scheduleRefresh)
      const mouseListener = editor.onMouseDown((event) => {
        const injectedText = (event.target as unknown as MonacoInjectedTextMouseTarget).detail?.injectedText
        const actionData = injectedText?.options?.attachedData
        if (!isExtractColumnActionData(actionData)) { return }

        event.event.preventDefault()
        event.event.stopPropagation()
        void openExtractDialog(model, actionData.target, options)
      })
      void refreshDecorations()

      return {
        dispose() {
          disposed = true
          refreshSequence += 1
          if (refreshTimer) { clearTimeout(refreshTimer) }
          contentListener.dispose()
          mouseListener.dispose()
          decorations.clear()
          actionDisposable.dispose()
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
  if (!editorModel) {
    toast.error('Не удалось открыть экспорт', { description: 'Активный SFC-документ недоступен.' })
    return
  }

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
    folderOptions: buildExtractComponentFolderOptions(Endge.domain.getFolders()),
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

function isExtractColumnActionData(value: unknown): value is ExtractColumnActionData {
  if (!value || typeof value !== 'object') { return false }

  const candidate = value as Partial<ExtractColumnActionData>
  return candidate.kind === ACTION_DATA_KIND
    && typeof candidate.target?.columnStart === 'number'
    && typeof candidate.target.sourceVersion === 'number'
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
    folderId: result.folderId ?? undefined,
  }) as RComponentSFC

  child.tag = result.tag
  child.source = childSource
  child.folderId = result.folderId

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
