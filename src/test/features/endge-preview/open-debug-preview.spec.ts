import { afterEach, describe, expect, it, vi } from 'vitest'

import { openEndgeDebugPreview } from '@/features/endge-preview/model/navigation/open-debug-preview'

describe('openEndgeDebugPreview', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('resolves the named route and opens it in an isolated browser tab', () => {
    const resolve = vi.fn(() => ({ href: '/preview/store/flights' }))
    const open = vi.fn(() => null)
    vi.stubGlobal('window', { open })

    openEndgeDebugPreview({ resolve } as any, 'store', ' flights ')

    expect(resolve).toHaveBeenCalledWith({
      name: 'endge-preview',
      params: { entityType: 'store', identity: 'flights' },
    })
    expect(open).toHaveBeenCalledWith('/preview/store/flights', '_blank', 'noopener,noreferrer')
  })

  it('does not open a tab without an identity', () => {
    const resolve = vi.fn()
    const open = vi.fn(() => null)
    vi.stubGlobal('window', { open })

    openEndgeDebugPreview({ resolve } as any, 'composition', ' ')

    expect(resolve).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })
})
