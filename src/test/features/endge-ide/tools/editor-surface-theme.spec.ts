import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  applyEndgeMonacoTheme,
  ENDGE_MONACO_DARK_THEME,
  ENDGE_MONACO_LIGHT_THEME,
  resolveEditorSurfaceColor,
} from '@/features/endge-ide/tools/source-editor/editor-surface-theme'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('editor surface theme', () => {
  it('returns the dark editor fallback outside the browser', () => {
    expect(resolveEditorSurfaceColor()).toBe('#142137')
  })

  it('reads a Monaco-compatible editor surface token', () => {
    vi.stubGlobal('document', { documentElement: {} })
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: () => '#223047',
    }))

    expect(resolveEditorSurfaceColor()).toBe('#223047')
  })

  it('falls back when the token is not a hex color Monaco can consume', () => {
    vi.stubGlobal('document', { documentElement: {} })
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: () => 'var(--background)',
    }))

    expect(resolveEditorSurfaceColor()).toBe('#142137')
  })

  it.each([
    [true, ENDGE_MONACO_DARK_THEME],
    [false, ENDGE_MONACO_LIGHT_THEME],
  ])('applies the Monaco theme for dark=%s', (isDark, expectedTheme) => {
    const defineTheme = vi.fn()
    const setTheme = vi.fn()
    const monaco = { editor: { defineTheme, setTheme } }

    expect(applyEndgeMonacoTheme(monaco as never, isDark)).toBe(expectedTheme)
    expect(defineTheme).toHaveBeenCalledWith(ENDGE_MONACO_DARK_THEME, expect.any(Object))
    expect(setTheme).toHaveBeenCalledWith(expectedTheme)
  })
})
