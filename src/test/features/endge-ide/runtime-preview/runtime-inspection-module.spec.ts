import { Endge } from '@endge/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EndgeIDERuntimeInspection_Module } from '@/features/endge-ide/modules/EndgeIDERuntimeInspection_Module'

afterEach(() => vi.restoreAllMocks())

describe('lifecycle UI наблюдения Runtime', () => {
  /** Граф IDE создаётся до boot Core; constructor не может читать ещё не настроенный Workspace. */
  it('создаёт модуль без обращения к Core и без подписок', () => {
    const runtime = vi.spyOn(Endge, 'runtime', 'get').mockImplementation(() => {
      throw new Error('Core is not booted')
    })
    const module = new EndgeIDERuntimeInspection_Module()
    expect(module.tree.value).toEqual([])
    expect(module.selectedNode.value).toBeNull()
    module.reset()
    expect(runtime).not.toHaveBeenCalled()
  })
})
