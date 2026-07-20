import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveEditorSurfaceColor } from '@/features/endge-ide/tools/source-editor/editor-surface-theme'

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
})
