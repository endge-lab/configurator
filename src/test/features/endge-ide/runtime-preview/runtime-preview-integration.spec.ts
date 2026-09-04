import { describe, expect, it } from 'vitest'

import { routes } from '@/app/router/routes'

describe('интеграция Runtime Preview с IDE', () => {
  it('не предоставляет отдельный маршрут preview', () => {
    expect(routes.some(route => String(route.path).startsWith('/preview/'))).toBe(false)
    expect(routes.some(route => route.name === 'endge-preview')).toBe(false)
  })
})
