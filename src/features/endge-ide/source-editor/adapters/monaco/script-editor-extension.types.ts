import type * as Monaco from 'monaco-editor'

export interface ScriptEditorMonacoContext {
  monaco: typeof Monaco
  editor: Monaco.editor.IStandaloneCodeEditor
  model: Monaco.editor.ITextModel
}

/** Isolated Monaco extension installed for one ScriptEditor instance. */
export interface ScriptEditorExtension {
  id: string
  install: (context: ScriptEditorMonacoContext) => Monaco.IDisposable | void
}
