const FALLBACK_EDITOR_SURFACE = '#142137'

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
