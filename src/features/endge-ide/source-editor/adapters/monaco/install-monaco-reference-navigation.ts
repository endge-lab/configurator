import type * as Monaco from 'monaco-editor'

export interface MonacoReferenceNavigationOptions {
  monaco: typeof Monaco
  editor: Monaco.editor.IStandaloneCodeEditor
  actionId: string
  openAt: (position: Monaco.Position) => boolean
  onMissing?: () => void
}

/** Installs one reference navigation gesture for keyboard and pointer users. */
export function installMonacoReferenceNavigation(
  options: MonacoReferenceNavigationOptions,
): Monaco.IDisposable {
  const action = options.editor.addAction({
    id: options.actionId,
    label: 'Открыть связанный документ',
    keybindings: [options.monaco.KeyMod.CtrlCmd | options.monaco.KeyCode.KeyB],
    run(editor) {
      const position = editor.getPosition()
      if (!position || options.openAt(position)) {
        return
      }
      options.onMissing?.()
    },
  })
  const mouse = options.editor.onMouseDown((event) => {
    const position = event.target.position
    if (!position || (!event.event.ctrlKey && !event.event.metaKey) || !event.event.leftButton) {
      return
    }
    if (!options.openAt(position)) {
      return
    }
    event.event.preventDefault()
    event.event.stopPropagation()
  })

  return {
    dispose() {
      action.dispose()
      mouse.dispose()
    },
  }
}
