import { Endge, RComponentSFC, RComputation, RField } from '@endge/core'
import { afterEach, describe, expect, it } from 'vitest'

import {
  destroySFCPreviewRuntime,
  launchSFCPreview,
  sfcPreviewRuntime,
} from '@/features/endge-ide/model/sfc-preview/sfc-preview-state'

describe('ComponentSFC port preview', () => {
  afterEach(() => {
    destroySFCPreviewRuntime()
    Endge.program.clear()
    Endge.domain.reset()
  })

  it('compiles default providers without Composition port configuration', async () => {
    const computation = new RComputation()
    computation.id = 101
    computation.identity = 'preview-state'
    computation.name = 'preview-state'
    computation.displayName = 'Preview state'
    computation.input = new RField('input', 'Input')
    computation.output = new RField('output', 'Output')
    computation.source = `export default function compute(input: Input): Output {
  return { value: get(input, 'value') }
}`

    const cell = new RComponentSFC()
    cell.id = 102
    cell.identity = 'preview-cell'
    cell.name = 'preview-cell'
    cell.displayName = 'Preview cell'
    cell.source = `<script setup lang="ts">
interface Output { value?: string }
defineProps<{ point?: Output }>()
</script>
<template><Text>{{ point?.value }}</Text></template>`

    Endge.domain.addComputation(computation)
    Endge.domain.addComponentSFC(cell)

    await launchSFCPreview({
      identity: 'preview-owner',
      source: `<script setup lang="ts">
interface Input { value?: string }
interface Output { value?: string }
interface CellProps { point?: Output }
const props = defineProps<{ value?: string }>()
definePreviewProps({ value: 'preview' })
const ports = definePorts({
  state: computation<Input, Output>({ default: 'preview-state' }),
  cell: component<CellProps>({ tag: 'Preview.Cell', default: 'preview-cell' }),
})
const state = ports.state({ value: props.value })
</script>
<template><Preview.Cell :point="state" /></template>`,
    })

    expect(sfcPreviewRuntime.value?.entityIdentity).toBe('preview-owner')
    expect(Endge.program.getComputationArtifact('preview-state')?.status).toBe('valid')
    expect(Endge.program.getArtifact('component-sfc', 'preview-cell')?.status).toBe('valid')
  })
})
