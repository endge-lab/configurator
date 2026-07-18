import { Endge } from '@endge/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { UIEditorRuntimePreviewSession } from '@/features/endge-admin-ui-editor/entities/ui-editor-runtime-preview'

describe('ui editor runtime preview session', () => {
  let session: UIEditorRuntimePreviewSession

  beforeEach(() => {
    prepareCompilerContext()
    session = new UIEditorRuntimePreviewSession()
  })

  afterEach(async () => {
    await session.dispose()
    Endge.configuration.reset()
    Endge.program.clear()
    Endge.domain.reset()
    Endge.workspace.reset()
  })

  it('mounts the current draft through ComponentSFCRuntimeHost and disposes it', async () => {
    const launched = await session.launch(`<script setup lang="ts">
defineProps<{ label: string }>()
definePreviewProps({ label: 'Runtime value' })
</script>
<template><Flex direction="row"><Text>{{ label }}</Text></Flex></template>`)

    expect(launched).toBe(true)
    expect(session.status.value).toBe('active')
    expect(session.runtime.value?.entityType).toBe('component-sfc')
    expect(session.runtime.value?.getIr()?.template.roots[0]).toMatchObject({ tag: 'Flex' })
    expect(session.input.value).toEqual({ kind: 'local', props: { label: 'Runtime value' } })

    const runtimeId = session.runtime.value!.id
    await session.dispose()
    expect(Endge.runtime.getRuntimeById(runtimeId)).toBeNull()
  })

  it('keeps the last valid runtime when the next source is invalid', async () => {
    await session.launch('<template><Flex><Text>Valid</Text></Flex></template>')
    const runtime = session.runtime.value

    expect(await session.launch('<template><Flex>')).toBe(false)
    expect(session.status.value).toBe('stale')
    expect(session.runtime.value).toBe(runtime)
    expect(session.error.value).toBeTruthy()
  })
})

function prepareCompilerContext(): void {
  Endge.workspace.apply({
    identity: 'ui-editor-preview-workspace',
    displayName: 'UI Editor Preview Workspace',
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
    identity: 'ui-editor-preview-project',
    allowedEnvironmentIds: [],
    configuration: { mode: 'inherit', patch: {} },
  } as any)
  Endge.domain.addEnvironment({
    id: 2,
    identity: 'ui-editor-preview-environment',
    configuration: { mode: 'inherit', patch: {} },
  } as any)
  Endge.domain.addTenant({
    id: 3,
    identity: 'ui-editor-preview-tenant',
    code: 'ui-editor-preview-tenant',
    configuration: { mode: 'inherit', patch: {} },
  } as any)
  Endge.configuration.build({
    dataProvider: 'plain',
    scope: {},
    vars: {},
    context: {
      projectIdentity: 'ui-editor-preview-project',
      environmentIdentity: 'ui-editor-preview-environment',
      tenantIdentity: 'ui-editor-preview-tenant',
    },
  })
}
