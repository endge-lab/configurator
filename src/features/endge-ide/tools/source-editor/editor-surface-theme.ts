import type * as Monaco from 'monaco-editor'

const FALLBACK_EDITOR_SURFACE = '#142137'
export const ENDGE_MONACO_DARK_THEME = 'endge-palenight'
export const ENDGE_MONACO_LIGHT_THEME = 'vs'

/** Returns the semantic editor surface as a Monaco-compatible hex color. */
export function resolveEditorSurfaceColor(): string {
  if (typeof document === 'undefined') {
    return FALLBACK_EDITOR_SURFACE
  }

  const color = getComputedStyle(document.documentElement)
    .getPropertyValue('--editor-surface')
    .trim()

  return /^#[\da-f]{6}$/i.test(color) ? color : FALLBACK_EDITOR_SURFACE
}

/** Defines the Endge dark palette and applies the Monaco theme for the current UI mode. */
export function applyEndgeMonacoTheme(monaco: typeof Monaco, isDark: boolean): string {
  monaco.editor.defineTheme(ENDGE_MONACO_DARK_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'bfc7d5', background: resolveEditorSurfaceColor().slice(1) },
      { token: 'keyword', foreground: 'c792ea' },
      { token: 'identifier', foreground: 'f07178' },
      { token: 'number', foreground: 'ffcb6b' },
      { token: 'string', foreground: 'c3e88d' },
      { token: 'comment', foreground: '717cb4', fontStyle: 'italic' },
    ],
    colors: {
      'editor.background': resolveEditorSurfaceColor(),
      'editor.foreground': '#bfc7d5',
      'editor.lineHighlightBackground': '#1c2b44',
      'editorCursor.foreground': '#ffcc00',
      'editorWhitespace.foreground': '#334155',
      'editorIndentGuide.background': '#334155',
      'editorLineNumber.foreground': '#64748b',
    },
  })

  const theme = isDark ? ENDGE_MONACO_DARK_THEME : ENDGE_MONACO_LIGHT_THEME
  monaco.editor.setTheme(theme)
  return theme
}
