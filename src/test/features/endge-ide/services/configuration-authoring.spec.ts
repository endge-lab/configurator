import { DomainSectionType } from '@endge/core'
import { describe, expect, it } from 'vitest'

import {
  getConfigurationReferenceDropKinds,
  getConfigurationReferenceOptions,
  getConfigurationReferenceSectionTypes,
} from '@/features/endge-ide/config/configuration-reference-options'
import { resolveConfigValueEditor } from '@/features/endge-ide/config/ConfigValueEditorRegistry'
import { buildWorkspaceTreeNodes } from '@/features/endge-ide/services/domain/domain-tree'

describe('configuration authoring registries', () => {
  it('dispatches specialized and recursive JSON-safe editors', () => {
    expect(resolveConfigValueEditor({ kind: 'reference', identity: 'Boolean' })).toBe('boolean')
    expect(resolveConfigValueEditor({ kind: 'reference', identity: 'TriggerSet' })).toBe('trigger-set')
    expect(resolveConfigValueEditor({ kind: 'reference', identity: 'JSON' })).toBe('json')
    expect(resolveConfigValueEditor({ kind: 'array', items: { kind: 'reference', identity: 'String' } })).toBe('array')
    expect(resolveConfigValueEditor({ kind: 'union', variants: [{ kind: 'reference', identity: 'String' }, { kind: 'reference', identity: 'Null' }] })).toBe('union')
  })

  it('resolves reference options with declared storage and folder drops', () => {
    const folderType = {
      id: 'RefFolder',
      identity: 'RefFolder',
      displayName: 'Папка',
      category: 'reference' as const,
      sourceVersion: 1,
      definition: null,
      entityReference: { target: 'folders', storage: 'identity' as const },
      status: 'valid' as const,
    }
    expect(getConfigurationReferenceOptions(folderType, {
      folders: [
        { id: 10, identity: 'operations', displayName: 'Операции' },
        { id: 11, identity: 'deleted', displayName: 'Удалённая', deletedAt: '2026-08-20T00:00:00Z' },
      ],
    })).toEqual([{ value: 'operations', label: 'Операции' }])
    expect(getConfigurationReferenceDropKinds(folderType)).toEqual(['folder'])
    expect(getConfigurationReferenceSectionTypes(folderType)).toEqual([])
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
