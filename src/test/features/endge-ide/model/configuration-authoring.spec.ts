import { DomainSectionType } from '@endge/core'
import { describe, expect, it } from 'vitest'

import { resolveConfigValueEditor } from '@/features/endge-ide/model/config/ConfigValueEditorRegistry'
import { buildWorkspaceTreeNodes } from '@/features/endge-ide/model/domain/domain-tree'

describe('Configuration authoring registries', () => {
  it('dispatches specialized and recursive JSON-safe editors', () => {
    expect(resolveConfigValueEditor({ kind: 'reference', identity: 'Boolean' })).toBe('boolean')
    expect(resolveConfigValueEditor({ kind: 'reference', identity: 'TriggerSet' })).toBe('trigger-set')
    expect(resolveConfigValueEditor({ kind: 'reference', identity: 'JSON' })).toBe('json')
    expect(resolveConfigValueEditor({ kind: 'array', items: { kind: 'reference', identity: 'String' } })).toBe('array')
    expect(resolveConfigValueEditor({ kind: 'union', variants: [{ kind: 'reference', identity: 'String' }, { kind: 'reference', identity: 'Null' }] })).toBe('union')
  })

  it('nests flat Configuration documents only under the active Workspace', () => {
    const nodes = buildWorkspaceTreeNodes([
      { id: 1, identity: 'default', displayName: 'Default', role: 'owner', active: true },
      { id: 2, identity: 'other', displayName: 'Other', role: 'viewer', active: true },
    ], 'default', [
      { id: 11, identity: 'zeta', displayName: 'Zeta' },
      { id: 10, identity: 'alpha', displayName: 'Alpha' },
      { id: 12, identity: 'deleted', displayName: 'Deleted', deletedAt: '2026-08-20T00:00:00Z' },
    ])

    expect(nodes[0]).toMatchObject({ type: 'folder', activeWorkspace: true, sectionType: DomainSectionType.Configuration })
    expect(nodes[0]?.children?.map(item => item.identity)).toEqual(['alpha', 'zeta'])
    expect(nodes[1]).toMatchObject({ type: 'file', activeWorkspace: false })
    expect(nodes[1]?.children).toBeUndefined()
  })
})
