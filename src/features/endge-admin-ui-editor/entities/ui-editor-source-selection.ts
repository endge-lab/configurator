import type { UIEditorDemoState } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'
import type { ScriptEditorExtension } from '@/features/endge-ide/source-editor/adapters/monaco/script-editor-extension.types'

import { watch } from 'vue'

import { findUIEditorSourceNodeAtOffset, projectUIEditorDocumentFromSFC } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-source'

export function createUIEditorSourceSelectionExtension(
  state: UIEditorDemoState,
): ScriptEditorExtension {
  return {
    id: 'endge-ui-editor-source-selection',
    install({ editor, model, monaco }) {
      const decorations = editor.createDecorationsCollection()
      let cachedDraftVersion = -1
      let cachedDraftLocations = state.sourceLocations

      const findNodeAtCursor = (offset: number): string | null => {
        if (model.getValue() === state.source) {
          return state.findSourceNodeAtOffset(offset)
        }

        const version = model.getVersionId()
        if (version !== cachedDraftVersion) {
          cachedDraftVersion = version
          cachedDraftLocations = projectUIEditorDocumentFromSFC(
            model.getValue(),
            state.document,
          ).sourceLocations
        }
        return findUIEditorSourceNodeAtOffset(cachedDraftLocations, offset)
      }

      const renderSelection = (reveal: boolean) => {
        const location = state.getSourceLocation(state.selectedNodeId)
        if (!location) {
          decorations.clear()
          return
        }

        const modelLength = model.getValueLength()
        const startOffset = Math.max(0, Math.min(location.openingTagRange.start, modelLength))
        const endOffset = Math.max(startOffset, Math.min(location.openingTagRange.end, modelLength))
        const start = model.getPositionAt(startOffset)
        const end = model.getPositionAt(endOffset)
        const range = new monaco.Range(
          start.lineNumber,
          start.column,
          end.lineNumber,
          end.column,
        )

        decorations.set([{
          range,
          options: {
            className: 'endge-ui-editor-source-selection',
            isWholeLine: true,
          },
        }])

        if (reveal && state.selectionOrigin === 'visual') {
          editor.revealRangeInCenterIfOutsideViewport(range, monaco.editor.ScrollType.Smooth)
        }
      }

      const cursorDisposable = editor.onDidChangeCursorPosition((event) => {
        if (
          !editor.hasTextFocus()
          || event.reason === monaco.editor.CursorChangeReason.ContentFlush
        ) {
          return
        }

        const nodeId = findNodeAtCursor(model.getOffsetAt(event.position))
        if (nodeId) {
          state.selectNode(nodeId, 'source')
        }
      })
      const contentDisposable = editor.onDidChangeModelContent(() => renderSelection(false))
      const stopSelectionWatch = watch(
        () => [state.selectedNodeId, state.selectionOrigin, state.sourceLocations] as const,
        () => renderSelection(true),
        { flush: 'post', immediate: true },
      )

      return {
        dispose() {
          stopSelectionWatch()
          cursorDisposable.dispose()
          contentDisposable.dispose()
          decorations.clear()
        },
      }
    },
  }
}
