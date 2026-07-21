/* eslint-disable style/max-statements-per-line */
import type { ExtractTypeCommandTarget, ExtractTypeDialogInput, ExtractTypeDialogResult } from './extract-type.types'
import type { RComponentSFCEditor } from '@/features/endge-ide/domain/entities/RComponentSFCEditor'
import type { ScriptEditorExtension } from '@/features/endge-ide/source-editor/adapters/monaco/script-editor-extension.types'
import type { RComponentSFC, RType } from '@endge/core'
import type * as Monaco from 'monaco-editor'

import {
  ComponentType,
  DocumentDraftFactory,
  Endge,
  serializeTypeSourceDocument,
} from '@endge/core'
import { defineAsyncComponent } from 'vue'
import { toast } from 'vue-sonner'

import { runBusy } from '@/features/endge-ide/model/core/endge-ide-busy'
import {
  openSourceEditorDialog,
  registerSourceEditorDialog,
} from '@/features/endge-ide/source-editor/core/source-editor-dialogs'

import {
  analyzeExtractableSFCTypeDeclarations,
  buildExtractableSFCTypePlan,
  removeExtractedTypeDeclarations,
  resolveExtractableSFCTypePlan,
} from './extract-type.analysis'
import { buildExtractTypeFolderOptions } from './extract-type.folders'

const DIALOG_ID = 'component-sfc.extract-type'
const ACTION_CLASS_NAME = 'endge-source-inline-action'
const ACTION_DISABLED_CLASS_NAME = 'endge-source-inline-action endge-source-inline-action--disabled'
const ACTION_DATA_KIND = 'endge.sfc.extract-type'
const TYPES_ROOT_IDENTITY = 'root-types'
let contributionSequence = 0

interface ExtractTypeActionData {
  kind: typeof ACTION_DATA_KIND
  target: ExtractTypeCommandTarget
}

interface MonacoInjectedTextMouseTarget {
  detail?: {
    injectedText?: {
      options?: { attachedData?: unknown }
    } | null
  }
}

registerSourceEditorDialog({
  id: DIALOG_ID,
  component: defineAsyncComponent(() => import('./ExtractType_Dialog.vue')),
})

export interface ExtractTypeContributionOptions {
  getEditorModel: () => RComponentSFCEditor | null
  getPersistedModel: () => RComponentSFC | null
}

export function createExtractTypeContribution(options: ExtractTypeContributionOptions): ScriptEditorExtension {
  const instanceId = ++contributionSequence
  return {
    id: `${DIALOG_ID}.${instanceId}`,
    install: ({ monaco, editor, model }) => {
      let disposed = false
      let refreshTimer: ReturnType<typeof setTimeout> | null = null
      let refreshSequence = 0
      const decorations = editor.createDecorationsCollection()

      const refreshDecorations = async (): Promise<void> => {
        const sequence = ++refreshSequence
        const sourceVersion = model.getVersionId()
        const declarations = analyzeExtractableSFCTypeDeclarations(model.getValue())
        if (disposed || sequence !== refreshSequence || sourceVersion !== model.getVersionId()) { return }

        decorations.set(declarations.map((declaration) => {
          const position = model.getPositionAt(declaration.actionAnchor)
          const plan = buildExtractableSFCTypePlan(declarations, declaration.range.start)
          const supported = Boolean(plan && !plan.unsupportedReason)
          const typeCount = plan?.declarations.length ?? 0
          return {
            range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
            options: {
              description: supported
                ? `Extract ${typeCount} local type${typeCount === 1 ? '' : 's'} to RType`
                : plan?.unsupportedReason ?? declaration.unsupportedReason ?? 'Unsupported RType extraction',
              showIfCollapsed: true,
              stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
              after: {
                content: supported
                  ? typeCount === 1 ? 'Выделить в RType' : `Выделить ${typeCount} RType`
                  : 'RType недоступен',
                inlineClassName: supported ? ACTION_CLASS_NAME : ACTION_DISABLED_CLASS_NAME,
                inlineClassNameAffectsLetterSpacing: true,
                cursorStops: monaco.editor.InjectedTextCursorStops.None,
                attachedData: {
                  kind: ACTION_DATA_KIND,
                  target: {
                    declarationStart: declaration.range.start,
                    sourceVersion,
                  },
                } satisfies ExtractTypeActionData,
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
        if (!isExtractTypeActionData(actionData)) { return }
        event.event.preventDefault()
        event.event.stopPropagation()
        void openExtractTypeDialog(model, actionData.target, options)
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
        },
      }
    },
  }
}

async function openExtractTypeDialog(
  model: Monaco.editor.ITextModel,
  target: ExtractTypeCommandTarget,
  options: ExtractTypeContributionOptions,
): Promise<void> {
  const plan = resolveExtractableSFCTypePlan(model.getValue(), target.declarationStart)
  if (!plan) {
    toast.info('Объявление изменилось', { description: 'Запустите выделение ещё раз.' })
    return
  }
  if (plan.unsupportedReason) {
    toast.warning('Нельзя выделить в RType', {
      description: plan.unsupportedReason,
    })
    return
  }
  const existingIdentity = plan.declarations.find(declaration => Endge.domain.hasTypeByIdentity(declaration.identity))?.identity
  if (existingIdentity) {
    toast.warning('RType уже существует', { description: existingIdentity })
    return
  }

  const input: ExtractTypeDialogInput = {
    rootIdentity: plan.root.identity,
    items: plan.declarations.map(declaration => ({
      declaration,
      sourcePreview: serializeTypeSourceDocument(declaration.document!),
    })),
    folderOptions: buildExtractTypeFolderOptions(Endge.domain.getFolders()),
  }
  const result = await openSourceEditorDialog<ExtractTypeDialogInput, ExtractTypeDialogResult>(DIALOG_ID, input)
  if (!result) { return }

  try {
    await runBusy(executeTypeExtraction(model, plan.root.range.start, result, options))
    toast.success(
      plan.declarations.length === 1 ? 'RType создан' : `Создано RType: ${plan.declarations.length}`,
      { description: plan.declarations.map(declaration => declaration.identity).join(', ') },
    )
  }
  catch (error) {
    toast.error('Не удалось выделить RType', {
      description: error instanceof Error ? error.message : String(error),
    })
  }
}

function isExtractTypeActionData(value: unknown): value is ExtractTypeActionData {
  if (!value || typeof value !== 'object') { return false }
  const candidate = value as Partial<ExtractTypeActionData>
  return candidate.kind === ACTION_DATA_KIND
    && typeof candidate.target?.declarationStart === 'number'
    && typeof candidate.target.sourceVersion === 'number'
}

async function executeTypeExtraction(
  model: Monaco.editor.ITextModel,
  declarationStart: number,
  result: ExtractTypeDialogResult,
  options: ExtractTypeContributionOptions,
): Promise<void> {
  const editorModel = options.getEditorModel()
  const persistedModel = options.getPersistedModel()
  if (!editorModel || !persistedModel) {
    throw new Error('Активный SFC-документ больше недоступен.')
  }

  const currentSource = model.getValue()
  const plan = resolveExtractableSFCTypePlan(currentSource, declarationStart)
  if (!plan) {
    throw new Error('TypeScript declaration изменилось. Повторите выделение.')
  }
  if (plan.unsupportedReason) {
    throw new Error(plan.unsupportedReason)
  }
  const existingIdentity = plan.declarations.find(declaration => Endge.domain.hasTypeByIdentity(declaration.identity))?.identity
  if (existingIdentity) {
    throw new Error(`RType с identity "${existingIdentity}" уже существует.`)
  }

  const folderId = result.folderId ?? TYPES_ROOT_IDENTITY
  const resultNames = new Map(result.types.map(item => [item.identity, item.name.trim()]))
  if (resultNames.size !== plan.declarations.length) {
    throw new Error('Набор типов в диалоге устарел. Повторите выделение.')
  }
  const types = plan.declarations.map((declaration) => {
    const name = resultNames.get(declaration.identity)
    if (!name || !declaration.document) {
      throw new Error(`Не задано название для RType "${declaration.identity}".`)
    }
    const type = DocumentDraftFactory.create('type', {
      identity: declaration.identity,
      name,
      folderId,
    }) as RType
    type.source = serializeTypeSourceDocument(declaration.document)
    type.folderId = folderId
    return type
  })

  const parentSource = removeExtractedTypeDeclarations(currentSource, plan.declarations)
  const previousPersistedSource = persistedModel.source
  const savedIdentities: string[] = []
  try {
    for (const type of types) {
      savedIdentities.push(type.identity)
      await Endge.schema.saveDocument(type.identity, 'type', { model: type })
    }

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

    for (const identity of savedIdentities.reverse()) {
      try {
        await Endge.schema.deleteDocumentHard(identity, 'type')
        Endge.domain.removeTypeByIdentity(identity)
      }
      catch (rollbackError) {
        console.error(`[extract-type] rollback failed for ${identity}`, rollbackError)
      }
    }
    throw error
  }
}
