/* eslint-disable style/max-statements-per-line */
import type { CompositionRuntimePropsContract } from '@/features/endge-ide/model/composition-runtime-props/composition-runtime-props'
import type { ScriptEditorExtension } from '@/features/endge-ide/source-editor/adapters/monaco/script-editor-extension.types'
import type { CompositionPreviewLiteral, CompositionPreviewPropValue, CompositionProgramPayload } from '@endge/core'
import type * as Monaco from 'monaco-editor'

import { Endge } from '@endge/core'
import { toast } from 'vue-sonner'

import {
  analyzeCompositionRuntimeProps,
  generateCompositionRuntimeProps,
} from '@/features/endge-ide/model/composition-runtime-props/composition-runtime-props'

const MARKER_OWNER = 'endge-composition-runtime-props'
const ACTION_CLASS_NAME = 'endge-source-inline-action'
const ACTION_DATA_KIND = 'endge.composition.generate-runtime-props'
let contributionSequence = 0

interface GenerateRuntimePropsActionData {
  kind: typeof ACTION_DATA_KIND
  runtimePath: string
  runtimeIdentity: string
  sourceVersion: number
}

interface MonacoInjectedTextMouseTarget {
  detail?: {
    injectedText?: {
      options?: { attachedData?: unknown }
    } | null
  }
}

/** Подключает cross-document props diagnostics и генерацию .withProps(...) для Composition source. */
export function createCompositionRuntimePropsContribution(): ScriptEditorExtension {
  const instanceId = ++contributionSequence

  return {
    id: `${MARKER_OWNER}.${instanceId}`,
    install: ({ monaco, editor, model }) => {
      let refreshTimer: ReturnType<typeof setTimeout> | null = null
      const decorations = editor.createDecorationsCollection()

      const refresh = (): void => {
        const payload = compileOwner(model.getValue())
        const issues = analyzeCompositionRuntimeProps(payload, resolveCompositionContract, materializePreviewValue)
        monaco.editor.setModelMarkers(model, MARKER_OWNER, issues.map(issue => ({
          severity: issue.severity === 'error'
            ? monaco.MarkerSeverity.Error
            : monaco.MarkerSeverity.Warning,
          code: issue.severity === 'error'
            ? 'composition-with-props-required'
            : 'composition-with-props-preview-available',
          message: issue.message,
          ...markerRange(model, issue.range),
        })))
        decorations.set(issues.filter(issue => issue.canGenerate).map((issue) => {
          const position = model.getPositionAt(compositionRuntimePropsActionAnchor(model.getValue(), issue.actionAnchor))
          return {
            range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
            options: {
              description: `Generate required props for ${issue.runtimeIdentity}`,
              showIfCollapsed: true,
              stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
              after: {
                content: 'Сгенерировать props',
                inlineClassName: ACTION_CLASS_NAME,
                inlineClassNameAffectsLetterSpacing: true,
                cursorStops: monaco.editor.InjectedTextCursorStops.None,
                attachedData: {
                  kind: ACTION_DATA_KIND,
                  runtimePath: issue.runtimePath,
                  runtimeIdentity: issue.runtimeIdentity,
                  sourceVersion: model.getVersionId(),
                } satisfies GenerateRuntimePropsActionData,
              },
            },
          }
        }))
      }

      const scheduleRefresh = (): void => {
        if (refreshTimer) { clearTimeout(refreshTimer) }
        refreshTimer = setTimeout(() => {
          refreshTimer = null
          refresh()
        }, 80)
      }
      const contentListener = model.onDidChangeContent(scheduleRefresh)
      const mouseListener = editor.onMouseDown((event) => {
        const injectedText = (event.target as unknown as MonacoInjectedTextMouseTarget).detail?.injectedText
        const actionData = injectedText?.options?.attachedData
        if (!isGenerateRuntimePropsActionData(actionData)) { return }

        event.event.preventDefault()
        event.event.stopPropagation()
        generateProps(editor, model, actionData)
      })
      refresh()

      return {
        dispose() {
          if (refreshTimer) { clearTimeout(refreshTimer) }
          contentListener.dispose()
          mouseListener.dispose()
          decorations.clear()
          monaco.editor.setModelMarkers(model, MARKER_OWNER, [])
        },
      }
    },
  }
}

/** Переносит inline action в конец строки, чтобы runtime modifiers не оказывались после кнопки. */
export function compositionRuntimePropsActionAnchor(source: string, callAnchor: number): number {
  const safeAnchor = Math.max(0, Math.min(callAnchor, source.length))
  const lineFeedOffset = source.indexOf('\n', safeAnchor)
  const lineEndOffset = lineFeedOffset === -1 ? source.length : lineFeedOffset
  return source[lineEndOffset - 1] === '\r' ? lineEndOffset - 1 : lineEndOffset
}

function generateProps(
  editor: Monaco.editor.IStandaloneCodeEditor,
  model: Monaco.editor.ITextModel,
  target: GenerateRuntimePropsActionData,
): void {
  if (target.sourceVersion !== model.getVersionId()) {
    toast.info('Source изменился', { description: 'Нажмите «Сгенерировать props» ещё раз.' })
    return
  }

  const source = model.getValue()
  const payload = compileOwner(source)
  const issue = analyzeCompositionRuntimeProps(payload, resolveCompositionContract, materializePreviewValue)
    .find(item => item.runtimePath === target.runtimePath && item.runtimeIdentity === target.runtimeIdentity)
  if (!payload || !issue?.canGenerate) {
    toast.info('Props уже изменились', { description: 'Проверьте актуальные diagnostics.' })
    return
  }

  const nextSource = generateCompositionRuntimeProps(source, payload, issue)
  if (nextSource === source) {
    toast.warning('Не удалось сгенерировать props')
    return
  }

  editor.pushUndoStop()
  editor.executeEdits(MARKER_OWNER, [{
    range: model.getFullModelRange(),
    text: nextSource,
    forceMoveMarkers: true,
  }])
  editor.pushUndoStop()
  toast.success('Props сгенерированы', { description: target.runtimeIdentity })
}

function compileOwner(source: string): CompositionProgramPayload | null {
  return (Endge.source.compile('composition', source).artifact as CompositionProgramPayload | undefined) ?? null
}

function resolveCompositionContract(identity: string): CompositionRuntimePropsContract | null {
  const compiled = Endge.program.getCompositionArtifact(identity)?.payload
  if (compiled) { return compiled }

  const model = Endge.domain.getComposition(identity)
  if (!model) { return null }

  return compileOwner(String(model.source ?? ''))
}

function materializePreviewValue(value: CompositionPreviewPropValue): CompositionPreviewLiteral | undefined {
  if (value.kind === 'literal') { return value.value }
  if (!Endge.mock.has(value.identity)) { return undefined }

  try {
    return Endge.mock.get<CompositionPreviewLiteral>(value.identity)
  }
  catch {
    return undefined
  }
}

function markerRange(
  model: Monaco.editor.ITextModel,
  range: { start: number, end: number },
): Pick<Monaco.editor.IMarkerData, 'startLineNumber' | 'startColumn' | 'endLineNumber' | 'endColumn'> {
  const start = model.getPositionAt(Math.max(0, Math.min(range.start, model.getValueLength())))
  const end = model.getPositionAt(Math.max(range.start + 1, Math.min(range.end, model.getValueLength())))
  return {
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column,
  }
}

function isGenerateRuntimePropsActionData(value: unknown): value is GenerateRuntimePropsActionData {
  if (!value || typeof value !== 'object') { return false }
  const candidate = value as Partial<GenerateRuntimePropsActionData>
  return candidate.kind === ACTION_DATA_KIND
    && typeof candidate.runtimePath === 'string'
    && typeof candidate.runtimeIdentity === 'string'
    && typeof candidate.sourceVersion === 'number'
}
