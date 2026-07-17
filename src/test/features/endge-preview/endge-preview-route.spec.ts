import { describe, expect, it } from 'vitest'

import { routes } from '@/router/routes'

describe('endge Preview route', () => {
  it('registers an isolated Grid surface for entity debug preview', () => {
    const route = routes.find(item => item.name === 'endge-preview')

    expect(route).toMatchObject({
      path: '/preview/:entityType/:identity',
      meta: {
        layout: 'grid',
        layoutScope: 'endge-preview',
      },
    })
    expect(typeof route?.component).toBe('function')
  })
})
