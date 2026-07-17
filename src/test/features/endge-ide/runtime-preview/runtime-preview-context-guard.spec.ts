import { beforeEach, describe, expect, it, vi } from 'vitest'

import { validateRuntimePreviewContext } from '@/features/endge-ide/model/runtime-preview/runtime-preview-context-guard'

const state = vi.hoisted(() => ({
  switching: false,
  project: 'airport',
  environment: 'dev',
  tenant: 'base',
  compositions: new Map<string, any>(),
}))

vi.mock('@endge/core', () => ({
  Endge: {
    context: {
      getCurrentProject: () => state.project,
      getCurrentEnvironment: () => state.environment,
      getCurrentTenant: () => state.tenant,
    },
    domain: {
      getComposition: (identity: string) => state.compositions.get(identity) ?? null,
    },
  },
}))

vi.mock('@/features/endge-configurator/model/endge-configurator', () => ({
  EndgeConfigurator: {
    get isSwitchingContext() { return state.switching },
  },
}))

describe('runtime Preview context guard', () => {
  beforeEach(() => {
    state.switching = false
    state.project = 'airport'
    state.environment = 'dev'
    state.tenant = 'base'
    state.compositions.clear()
  })

  it('allows only the current project root', () => {
    expect(validateRuntimePreviewContext({ entityType: 'project', identity: 'airport' }).valid).toBe(true)
    expect(validateRuntimePreviewContext({ entityType: 'project', identity: 'other' })).toMatchObject({
      valid: false,
      message: 'Невозможно запустить проект',
    })
  })

  it.each([
    ['project', 'airport', true],
    ['project', 'other', false],
    ['environment', 'dev', true],
    ['environment', 'prod', false],
    ['tenant', 'base', true],
    ['tenant', 'customer', false],
  ])('validates %s-owned compositions', (kind, kindIdentity, expected) => {
    state.compositions.set('entry', { identity: 'entry', kind, kindIdentity })
    expect(validateRuntimePreviewContext({ entityType: 'composition', identity: 'entry' }).valid).toBe(expected)
  })

  it('allows general compositions and blocks launches while context is switching', () => {
    state.compositions.set('library-entry', { identity: 'library-entry', kind: 'library', kindIdentity: null })
    expect(validateRuntimePreviewContext({ entityType: 'composition', identity: 'library-entry' }).valid).toBe(true)

    state.switching = true
    expect(validateRuntimePreviewContext({ entityType: 'store', identity: 'data' })).toMatchObject({
      valid: false,
      message: 'Контекст приложения переключается',
    })
  })
})
