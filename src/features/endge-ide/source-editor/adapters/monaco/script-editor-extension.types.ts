import type * as Monaco from 'monaco-editor'

export interface ScriptEditorMonacoContext {
  monaco: typeof Monaco
  editor: Monaco.editor.IStandaloneCodeEditor
  model: Monaco.editor.ITextModel
}

// Изолированное расширение Monaco для одного экземпляра ScriptEditor.
export interface ScriptEditorExtension {
  id: string
  install: (context: ScriptEditorMonacoContext) => Monaco.IDisposable | void
  // Расширение владеет подсказками в этой позиции: подсказки Endge Source там не показываются.
  suppressesSourceCompletions?: (model: Monaco.editor.ITextModel, offset: number) => boolean
}
