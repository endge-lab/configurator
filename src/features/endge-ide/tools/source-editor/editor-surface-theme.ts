import type * as Monaco from 'monaco-editor'

const FALLBACK_EDITOR_SURFACE = '#292D3E'
export const ENDGE_MONACO_DARK_THEME = 'endge-palenight'
export const ENDGE_MONACO_LIGHT_THEME = 'vs'
export const ENDGE_MONACO_SCROLLBAR_OPTIONS: Monaco.editor.IEditorScrollbarOptions = {
  vertical: 'visible',
  horizontal: 'visible',
  verticalScrollbarSize: 8,
  horizontalScrollbarSize: 8,
  verticalSliderSize: 6,
  horizontalSliderSize: 6,
  useShadows: false,
}

/** Возвращает семантическую поверхность редактора как совместимый с Monaco HEX-цвет. */
export function resolveEditorSurfaceColor(): string {
  if (typeof document === 'undefined') {
    return FALLBACK_EDITOR_SURFACE
  }

  const color = getComputedStyle(document.documentElement)
    .getPropertyValue('--editor-surface')
    .trim()

  return /^#[\da-f]{6}$/i.test(color) ? color : FALLBACK_EDITOR_SURFACE
}

/** Определяет тёмную палитру Endge и применяет тему Monaco для текущего режима UI. */
export function applyEndgeMonacoTheme(monaco: typeof Monaco, isDark: boolean): string {
  monaco.editor.defineTheme(ENDGE_MONACO_DARK_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'a6accd', background: resolveEditorSurfaceColor().slice(1) },
      { token: 'keyword', foreground: 'c792ea' },
      { token: 'identifier', foreground: 'f07178' },
      { token: 'number', foreground: 'ffcb6b' },
      { token: 'string', foreground: 'c3e88d' },
      { token: 'comment', foreground: '717cb4', fontStyle: 'italic' },
    ],
    colors: {
      'editor.background': resolveEditorSurfaceColor(),
      'editor.foreground': '#A6ACCD',
      'editor.lineHighlightBackground': '#32364A',
      'editor.selectionBackground': '#444267',
      'editor.inactiveSelectionBackground': '#3B3F51',
      'editorCursor.foreground': '#ffcc00',
      'editorWhitespace.foreground': '#3B3F51',
      'editorIndentGuide.background': '#3B3F51',
      'editorIndentGuide.activeBackground': '#676E95',
      'editorLineNumber.foreground': '#676E95',
      'editorLineNumber.activeForeground': '#A6ACCD',
      'scrollbarSlider.background': '#8C419E',
      'scrollbarSlider.hoverBackground': '#8C419E',
      'scrollbarSlider.activeBackground': '#8C419E',
    },
  })

  const theme = isDark ? ENDGE_MONACO_DARK_THEME : ENDGE_MONACO_LIGHT_THEME
  monaco.editor.setTheme(theme)
  return theme
}
