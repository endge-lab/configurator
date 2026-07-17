import { describe, expect, it } from 'vitest'

import { routes } from '@/router/routes'

describe('runtime Preview IDE integration', () => {
  it('does not expose a standalone preview route', () => {
    expect(routes.some(route => String(route.path).startsWith('/preview/'))).toBe(false)
    expect(routes.some(route => route.name === 'endge-preview')).toBe(false)
  })
})
