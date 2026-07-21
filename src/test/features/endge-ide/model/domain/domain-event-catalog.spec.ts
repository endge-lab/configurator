import { createEmptyComponentSFCPortManifest, createBuiltInComponentPortManifest, DomainSectionType } from '@endge/core'
import { describe, expect, it } from 'vitest'

import { buildEventCatalogRoot } from '@/features/endge-ide/model/domain/domain-event-catalog'

describe('frontend Event catalog', () => {
  it('groups built-in and local own/forwarded Events without persisted entities', () => {
    const local = createEmptyComponentSFCPortManifest()
    local.emits.events.push(
      { kind: 'event', role: 'emits', name: 'opened', payloadType: '{ id: string }', sourceRange: { start: 10, end: 20 } },
      {
        kind: 'event',
        role: 'emits',
        name: 'rowActivated',
        payloadType: 'TableRowActivatedEvent',
        forwardedFrom: { nodeId: 'table', ref: 'table', componentTag: 'Table', portName: 'rowActivated' },
      },
    )
    const root = buildEventCatalogRoot(
      [{ tag: 'Table', manifest: createBuiltInComponentPortManifest('Table')! }],
      [{ identity: 'orders', displayName: 'Заказы', manifest: local }],
    )

    expect(root).toMatchObject({ id: 'root-events', sectionType: DomainSectionType.Event, virtual: true })
    expect(root.children?.map(node => node.name)).toEqual(['Built-in', 'Local'])
    const table = root.children?.[0]?.children?.[0]
    expect(table?.children).toHaveLength(9)
    const component = root.children?.[1]?.children?.[0]
    expect(component?.children?.map(node => node.name)).toEqual(['Собственные', 'Проброшенные'])
    expect(component?.children?.[0]?.children?.[0]).toMatchObject({
      identity: 'orders.opened',
      virtual: true,
      sourceDocument: { identity: 'orders', docType: 'component-sfc' },
    })
  })
})
