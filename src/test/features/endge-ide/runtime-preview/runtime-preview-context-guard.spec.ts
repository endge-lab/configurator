import { beforeEach, describe, expect, it, vi } from 'vitest'

import { validateRuntimePreviewContext } from '@/features/endge-ide/services/runtime-preview/runtime-preview-context-guard'

const state = vi.hoisted(() => ({
  switching: false,
  compositions: new Map<string, any>(),
}))

vi.mock('@endge/core', () => ({
  Endge: {
    domain: {
      getComposition: (identity: string) => state.compositions.get(identity) ?? null,
    },
  },
}))

describe('защита контекста Runtime Preview', () => {
  beforeEach(() => {
    state.switching = false
    state.compositions.clear()
  })

  it('отклоняет отсутствующую Composition', () => {
    expect(validateRuntimePreviewContext({ entityType: 'composition', identity: 'other' })).toMatchObject({
      valid: false,
      message: 'Композиция недоступна',
    })
  })

  it.each([
    ['workspace', 'workspace-a'],
    ['query', 'flights'],
    ['library', null],
  ])('разрешает Composition поддерживаемого вида %s', (kind, kindIdentity) => {
    state.compositions.set('entry', { identity: 'entry', kind, kindIdentity })
    expect(validateRuntimePreviewContext({ entityType: 'composition', identity: 'entry' }).valid).toBe(true)
  })

  it('разрешает общие Compositions и блокирует запуск во время переключения контекста', () => {
    state.compositions.set('library-entry', { identity: 'library-entry', kind: 'library', kindIdentity: null })
    expect(validateRuntimePreviewContext({ entityType: 'composition', identity: 'library-entry' }).valid).toBe(true)

    state.switching = true
    expect(validateRuntimePreviewContext({ entityType: 'store', identity: 'data' }, state.switching)).toMatchObject({
      valid: false,
      message: 'Контекст приложения переключается',
    })
  })
})
