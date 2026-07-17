import { Endge, RComponentSFC, RComputation } from '@endge/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  destroySFCPreviewRuntime,
  launchSFCPreview,
  sfcPreviewRuntime,
} from '@/features/endge-ide/model/sfc-preview/sfc-preview-state'

describe('ComponentSFC port preview', () => {
  beforeEach(() => prepareCompilerContext())

  afterEach(async () => {
    await destroySFCPreviewRuntime()
    Endge.configuration.reset()
    Endge.program.clear()
    Endge.domain.reset()
    Endge.workspace.reset()
  })

  it('compiles default providers without Composition port configuration', async () => {
    const computation = new RComputation()
    computation.id = 101
    computation.identity = 'preview-state'
    computation.name = 'preview-state'
    computation.displayName = 'Preview state'
    computation.source = `defineComputation({
  outputs: {
    state: { value: input('value') },
  },
  result: output('state'),
})`

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
<template><Preview.Cell :point="state.value" /></template>`,
    })

    expect(sfcPreviewRuntime.value?.entityIdentity).toBe('preview-owner')
    expect(Endge.program.getComputationArtifact('preview-state')?.status).toBe('valid')
    expect(Endge.program.getArtifact('component-sfc', 'preview-cell')?.status).toBe('valid')
  })
})

function prepareCompilerContext(): void {
  Endge.workspace.apply({
    identity: 'preview-workspace',
    displayName: 'Preview Workspace',
    configuration: {
      vars: [],
      locales: [{ code: 'en', displayName: 'English', shortLabel: 'EN', direction: 'ltr' }],
      defaultLocale: 'en',
      fallbackLocale: 'en',
      themes: [{ identity: 'light', displayName: 'Light' }],
      defaultTheme: 'light',
      defaultAuthProfileIdentity: null,
      sfcAdapterIds: ['native-vue'],
      defaultSfcAdapterId: 'native-vue',
    },
  })
  Endge.domain.addProject({
    id: 1,
    identity: 'preview-project',
    allowedEnvironmentIds: [],
    configuration: { mode: 'inherit', patch: {} },
  } as any)
  Endge.domain.addEnvironment({
    id: 2,
    identity: 'preview-environment',
    configuration: { mode: 'inherit', patch: {} },
  } as any)
  Endge.domain.addTenant({
    id: 3,
    identity: 'preview-tenant',
    code: 'preview-tenant',
    configuration: { mode: 'inherit', patch: {} },
  } as any)
  Endge.configuration.build({
    dataProvider: 'plain',
    scope: {},
    vars: {},
    context: {
      projectIdentity: 'preview-project',
      environmentIdentity: 'preview-environment',
      tenantIdentity: 'preview-tenant',
    },
  })
}
