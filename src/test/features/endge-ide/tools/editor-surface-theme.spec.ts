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

describe('тема поверхности редактора', () => {
  it('возвращает резервную тёмную тему редактора вне браузера', () => {
    expect(resolveEditorSurfaceColor()).toBe('#292D3E')
  })

  it('читает совместимый с Monaco токен поверхности редактора', () => {
    vi.stubGlobal('document', { documentElement: {} })
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: () => '#223047',
    }))

    expect(resolveEditorSurfaceColor()).toBe('#223047')
  })

  it('использует резервное значение, если токен не является hex-цветом, поддерживаемым Monaco', () => {
    vi.stubGlobal('document', { documentElement: {} })
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: () => 'var(--background)',
    }))

    expect(resolveEditorSurfaceColor()).toBe('#292D3E')
  })

  it.each([
    [true, ENDGE_MONACO_DARK_THEME],
    [false, ENDGE_MONACO_LIGHT_THEME],
  ])('применяет тему Monaco при dark=%s', (isDark, expectedTheme) => {
    const defineTheme = vi.fn()
    const setTheme = vi.fn()
    const monaco = { editor: { defineTheme, setTheme } }

    expect(applyEndgeMonacoTheme(monaco as never, isDark)).toBe(expectedTheme)
    expect(defineTheme).toHaveBeenCalledWith(ENDGE_MONACO_DARK_THEME, expect.any(Object))
    expect(setTheme).toHaveBeenCalledWith(expectedTheme)
  })
})
