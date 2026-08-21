import type * as Monaco from 'monaco-editor'

import { useSmartTabViewState, useSmartTabViewStateFlush } from '@/components/ui/smart-tabs'

const CAPTURE_DELAY_MS = 180

interface PersistedMonacoViewState {
  sourceFingerprint: string
  editorState: Monaco.editor.ICodeEditorViewState
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isEditorViewState(value: unknown): value is Monaco.editor.ICodeEditorViewState {
  if (!isRecord(value)) {
    return false
  }
  return Array.isArray(value.cursorState)
    && isRecord(value.viewState)
    && isRecord(value.contributionsState)
}

function isPersistedMonacoViewState(value: unknown): value is PersistedMonacoViewState {
  return isRecord(value)
    && typeof value.sourceFingerprint === 'string'
    && isEditorViewState(value.editorState)
}

/**
 * Cheap content identity guard. Two independent 32-bit accumulators plus length
 * make accidental restoration onto different source text vanishingly unlikely.
 */
function sourceFingerprint(source: string): string {
  let first = 0x811C9DC5
  let second = 0x9E3779B9
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ code, 0x85EBCA6B)
    second ^= second >>> 13
  }
  return `${source.length}:${(first >>> 0).toString(36)}:${(second >>> 0).toString(36)}`
}

export function usePersistedMonacoViewState(key: string) {
  const persistedState = useSmartTabViewState<PersistedMonacoViewState | null>(key, {
    version: 1,
    defaultValue: () => null,
    validate: value => value === null || isPersistedMonacoViewState(value),
  })
  const flushStorage = useSmartTabViewStateFlush()
  let editor: Monaco.editor.IStandaloneCodeEditor | null = null
  let captureTimer: ReturnType<typeof setTimeout> | null = null
  let disposables: Monaco.IDisposable[] = []

  function capture(flush = false): void {
    if (!editor) {
      return
    }
    const model = editor.getModel()
    const editorState = editor.saveViewState()
    if (!model || !editorState) {
      return
    }
    persistedState.value = {
      sourceFingerprint: sourceFingerprint(model.getValue()),
      editorState,
    }
    if (flush) {
      flushStorage()
    }
  }

  function scheduleCapture(): void {
    if (captureTimer) {
      clearTimeout(captureTimer)
    }
    captureTimer = setTimeout(() => {
      captureTimer = null
      capture()
    }, CAPTURE_DELAY_MS)
  }

  function captureBeforePageHide(): void {
    if (captureTimer) {
      clearTimeout(captureTimer)
      captureTimer = null
    }
    capture(true)
  }

  function attach(instance: Monaco.editor.IStandaloneCodeEditor): void {
    editor = instance
    const model = instance.getModel()
    const stored = persistedState.value
    if (stored && model && stored.sourceFingerprint === sourceFingerprint(model.getValue())) {
      instance.restoreViewState(stored.editorState)
    }
    else if (stored) {
      persistedState.value = null
    }

    disposables = [
      instance.onDidScrollChange(scheduleCapture),
      instance.onDidChangeCursorSelection(scheduleCapture),
      instance.onDidChangeHiddenAreas(scheduleCapture),
      instance.onDidChangeModelContent(scheduleCapture),
    ]
    window.addEventListener('pagehide', captureBeforePageHide)
  }

  function detach(): void {
    if (!editor) {
      return
    }
    if (captureTimer) {
      clearTimeout(captureTimer)
      captureTimer = null
    }
    capture(true)
    window.removeEventListener('pagehide', captureBeforePageHide)
    disposables.forEach(disposable => disposable.dispose())
    disposables = []
    editor = null
  }

  return { attach, detach }
}
