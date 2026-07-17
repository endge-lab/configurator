import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildRuntimePreviewTree } from '@/features/endge-ide/model/runtime-preview/runtime-preview-tree-builder'

const { artifacts, compositions } = vi.hoisted(() => ({
  artifacts: new Map<string, any>(),
  compositions: [] as any[],
}))

vi.mock('@endge/core', async importOriginal => ({
  ...await importOriginal<typeof import('@endge/core')>(),
  Endge: {
    domain: {
      getProject: (identity: string) => identity === 'airport' ? { identity, displayName: 'Airport' } : null,
      getComponentSFC: (identity: string) => ({ identity, displayName: identity === 'table-sfc' ? 'Flight table' : identity }),
      getStore: (identity: string) => identity === 'flights' ? { identity, displayName: 'Flights' } : null,
      getStyle: (identity: string) => identity === 'airport-theme' ? { identity, name: 'Airport theme' } : null,
      getQuery: () => null,
      getFilter: () => null,
      getComposition: (identity: string) => compositions.find(item => item.identity === identity) ?? null,
      getCompositions: () => compositions,
    },
    program: {
      getCompositionArtifact: (identity: string) => artifacts.get(identity) ?? null,
    },
  },
}))

describe('runtime Preview tree builder', () => {
  beforeEach(() => {
    artifacts.clear()
    compositions.splice(0)
  })

  it('flattens scope_default and preserves named scopes and nested compositions', () => {
    compositions.push(
      { identity: 'project-entry', displayName: 'Entry', kind: 'project', kindIdentity: 'airport', active: true },
      { identity: 'child', displayName: 'Child', kind: 'library', active: true },
    )
    artifacts.set('project-entry', artifact(payload({
      resources: [{ name: 'theme', path: 'theme', kind: 'style', identity: 'airport-theme', scopePath: 'scope_default' }],
      runtimes: [
        runtime('table', 'component', 'scope_default', 'table-sfc'),
        runtime('childRuntime', 'composition', 'pages', 'child'),
      ],
      scopes: [
        scope('scope_default', null),
        scope('pages', 'scope_default'),
      ],
    })))
    artifacts.set('child', artifact(payload({
      runtimes: [runtime('filter', 'filter-view', 'scope_default', 'flight-filter')],
    })))

    const [project] = buildRuntimePreviewTree({ entityType: 'project', identity: 'airport' })
    const entry = project?.children[0]

    expect(project).toMatchObject({
      title: 'Airport',
      presentation: { icon: 'Briefcase', colorClass: 'text-sky-500' },
    })
    expect(entry?.children.map(node => node.kind)).toEqual(['resource', 'runtime', 'scope'])
    expect(entry).toMatchObject({
      title: 'Entry',
      presentation: { icon: 'Network', colorClass: 'text-sky-500' },
    })
    expect(entry?.children[0]).toMatchObject({
      title: 'Airport theme',
      subtitle: 'theme',
      presentation: { icon: 'Palette', colorClass: 'text-fuchsia-500' },
    })
    expect(entry?.children[1]).toMatchObject({
      title: 'Flight table',
      subtitle: 'table',
      renderable: true,
      presentation: { icon: 'Puzzle', colorClass: 'text-blue-500' },
    })
    const pages = entry?.children[2]
    expect(pages?.kind).toBe('scope')
    expect(pages?.children[0]).toMatchObject({
      kind: 'composition',
      title: 'Child',
      activationMode: 'manual',
    })
    expect(pages?.children[0]?.children[0]).toMatchObject({
      title: 'flight-filter',
      subtitle: 'filter',
      renderable: true,
    })
  })

  it('creates a standalone renderable Store root', () => {
    const [store] = buildRuntimePreviewTree({ entityType: 'store', identity: 'flights' })

    expect(store).toMatchObject({
      id: 'store:flights',
      kind: 'runtime',
      title: 'Flights',
      entityType: 'store',
      identity: 'flights',
      renderable: true,
    })
  })
})

function artifact(value: any) {
  return { status: 'valid', payload: value }
}

function payload(overrides: Record<string, any> = {}) {
  return {
    activation: { mode: 'startup' },
    resources: [],
    runtimes: [],
    scopes: [scope('scope_default', null)],
    ...overrides,
  }
}

function scope(path: string, parentPath: string | null) {
  return {
    name: path,
    path,
    parentPath,
    effectiveActivation: { mode: path === 'pages' ? 'manual' : 'startup' },
    children: [],
  }
}

function runtime(name: string, kind: string, scopePath: string, identity: string) {
  return {
    name,
    path: name,
    kind,
    identity,
    componentIdentity: kind === 'component' ? identity : null,
    scopePath,
    effectiveActivation: { mode: kind === 'composition' ? 'manual' : 'startup' },
  }
}
