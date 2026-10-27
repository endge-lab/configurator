import type { CompositionRuntimeHost, RuntimeHost } from '@endge/core'

import { describe, expect, it } from 'vitest'

import { collectCompositionRenderables } from '@/features/endge-ide/services/runtime-preview/runtime-preview-renderables'

interface FakeChild {
  path: string
  kind: string
  scopePath?: string
  status?: string
  renderable?: boolean
  children?: FakeChild[]
}

function runtime(child: FakeChild): RuntimeHost<any, any> {
  if (child.kind === 'composition') {
    return Object.assign(host(child.children ?? []), { status: child.status ?? 'active' }) as unknown as RuntimeHost<any, any>
  }
  return {
    id: child.path,
    status: child.status ?? 'active',
    hasCapability: (capability: string) => capability === 'renderable' && child.renderable !== false,
  } as unknown as RuntimeHost<any, any>
}

function host(children: FakeChild[], sourceOrder = children.map(child => child.path)): CompositionRuntimeHost {
  return {
    id: 'host',
    getArtifactPayload: () => ({ runtimes: sourceOrder.map(path => ({ path })) }),
    getChildren: () => children.map(child => ({
      name: child.path,
      descriptor: { path: child.path, kind: child.kind, scopePath: child.scopePath ?? 'scope_default' },
      runtime: runtime(child),
    })),
  } as unknown as CompositionRuntimeHost
}

describe('отображаемые runtime Composition в Runtime Preview', () => {
  it('раскрывает активные вложенные Composition на месте вызова в порядке Source', () => {
    const root = host([
      // Порядок создания отличается от Source: экран создан раньше шапки.
      {
        path: 'overview.page',
        kind: 'composition',
        scopePath: 'overview',
        children: [{ path: 'board', kind: 'component' }],
      },
      { path: 'feed', kind: 'stream', renderable: false },
      { path: 'header', kind: 'component' },
      {
        path: 'orders.page',
        kind: 'composition',
        scopePath: 'orders',
        status: 'stopped',
        children: [{ path: 'table', kind: 'component' }],
      },
    ], ['feed', 'header', 'overview.page', 'orders.page'])

    expect(collectCompositionRenderables(root).map(item => item.id)).toEqual(['header', 'board'])
    expect(collectCompositionRenderables(root, 'overview').map(item => item.id)).toEqual(['board'])
  })
})
