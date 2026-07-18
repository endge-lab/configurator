import type { EndgeConfigurationContribution, REnvironment, RTenant } from '@endge/core'

import { describe, expect, it } from 'vitest'

import { REnvironmentEditor } from '@/features/endge-ide/domain/entities/REnvironmentEditor'
import { RTenantEditor } from '@/features/endge-ide/domain/entities/RTenantEditor'

const nextConfiguration = {
  mode: 'inherit',
  patch: {
    defaultTheme: { op: 'set', value: 'dark' },
  },
} satisfies EndgeConfigurationContribution

describe('system context configuration editors', () => {
  it('updates only configuration for a system environment', () => {
    const source = {
      id: 1,
      identity: 'dev',
      name: 'Development',
      displayName: 'Development',
      managedBy: 'system',
      managedById: null,
      configuration: { mode: 'inherit', patch: {} },
    } as unknown as REnvironment
    const editor = new REnvironmentEditor()
    editor.fillFromSource(source)
    editor.identity = 'changed-dev'
    editor.displayName = 'Changed development'
    editor.configuration = nextConfiguration

    editor.updateConfigurationSource(source)

    expect(source.identity).toBe('dev')
    expect(source.displayName).toBe('Development')
    expect(source.configuration).toEqual(nextConfiguration)
    expect(source.configuration).not.toBe(nextConfiguration)
  })

  it('updates only configuration for a system tenant', () => {
    const source = {
      id: 1,
      identity: 'default',
      name: 'Default tenant',
      displayName: 'Default tenant',
      code: 'DEFAULT',
      description: 'System tenant',
      managedBy: 'system',
      managedById: null,
      configuration: { mode: 'inherit', patch: {} },
    } as unknown as RTenant
    const editor = new RTenantEditor()
    editor.fillFromSource(source)
    editor.identity = 'changed-default'
    editor.displayName = 'Changed tenant'
    editor.configuration = nextConfiguration

    editor.updateConfigurationSource(source)

    expect(source.identity).toBe('default')
    expect(source.displayName).toBe('Default tenant')
    expect(source.configuration).toEqual(nextConfiguration)
    expect(source.configuration).not.toBe(nextConfiguration)
  })
})
