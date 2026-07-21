import { describe, expect, it } from 'vitest'

import {
  analyzeExtractableSFCTypeDeclarations,
  removeExtractedTypeDeclaration,
  removeExtractedTypeDeclarations,
  resolveExtractableSFCTypePlan,
} from '@/features/endge-ide/source-editor/contributions/types/extract-type/extract-type.analysis'
import { buildExtractTypeFolderOptions } from '@/features/endge-ide/source-editor/contributions/types/extract-type/extract-type.folders'

describe('sFC local type extraction', () => {
  it('finds a safe declaration and removes only that declaration', () => {
    const source = `<script setup lang="ts">
interface FlightRow {
  id: string
  delayed?: boolean
}

const props = defineProps<FlightRow>()
</script>
<template><Text>{{ props.id }}</Text></template>
`
    const [declaration] = analyzeExtractableSFCTypeDeclarations(source)

    expect(declaration).toMatchObject({
      identity: 'FlightRow',
      kind: 'interface',
      unsupportedReason: null,
    })
    expect(source.slice(declaration!.range.start, declaration!.range.end)).toContain('interface FlightRow')
    expect(declaration!.actionAnchor).toBe(source.indexOf('\n', source.indexOf('interface FlightRow')))

    const next = removeExtractedTypeDeclaration(source, declaration!)
    expect(next).not.toContain('interface FlightRow')
    expect(next).toContain('defineProps<FlightRow>()')
    expect(next).toContain('<template>')
  })

  it('keeps unsupported generic aliases visible with a reason', () => {
    const [declaration] = analyzeExtractableSFCTypeDeclarations(`<script setup lang="ts">
type Entity<T> = { value: T }
</script>`)

    expect(declaration).toMatchObject({
      identity: 'Entity',
      document: null,
      unsupportedReason: 'Generic type alias пока нельзя преобразовать в RType.',
    })
  })

  it('collects transitive local dependencies in dependency-first order', () => {
    const source = `<script setup lang="ts">
interface Airport { code: string }
interface Flight { origin: Airport }
interface Board { flights: Flight[] }

defineProps<Board>()
</script>`
    const declarations = analyzeExtractableSFCTypeDeclarations(source)
    const board = declarations.find(declaration => declaration.identity === 'Board')!
    const plan = resolveExtractableSFCTypePlan(source, board.range.start)

    expect(plan?.unsupportedReason).toBeNull()
    expect(plan?.declarations.map(declaration => declaration.identity)).toEqual(['Airport', 'Flight', 'Board'])

    const next = removeExtractedTypeDeclarations(source, plan!.declarations)
    expect(next).not.toContain('interface Airport')
    expect(next).not.toContain('interface Flight')
    expect(next).not.toContain('interface Board')
    expect(next).toContain('defineProps<Board>()')
  })

  it('rejects a dependency cycle without hiding the declaration', () => {
    const source = `<script setup lang="ts">
interface NodeA { next: NodeB }
interface NodeB { next: NodeA }
</script>`
    const [nodeA] = analyzeExtractableSFCTypeDeclarations(source)
    const plan = resolveExtractableSFCTypePlan(source, nodeA!.range.start)

    expect(nodeA?.document).not.toBeNull()
    expect(plan?.declarations).toEqual([])
    expect(plan?.unsupportedReason).toBe('Циклическая локальная зависимость: NodeA → NodeB → NodeA.')
  })

  it('builds selectable folders only below the types root', () => {
    const folders = buildExtractTypeFolderOptions([
      { id: 'types', identity: 'root-types', entityType: 'types' },
      { id: 'contracts', identity: 'contracts', name: 'Contracts', entityType: 'types', parent: 'types' },
      { id: 'nested', identity: 'nested', name: 'Flights', entityType: 'types', parent: 'contracts' },
      { id: 'components', identity: 'root-components', entityType: 'components' },
    ])

    expect(folders).toEqual([
      { id: 'contracts', name: 'Contracts', path: 'Contracts' },
      { id: 'nested', name: 'Flights', path: 'Contracts / Flights' },
    ])
  })
})
