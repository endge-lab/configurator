import type { RuntimeHostSnapshot, RuntimeInspectionSnapshot } from '@endge/core'
import { createDefaultEndgeConfiguration, Endge } from '@endge/core'
import { Raph } from '@endge/raph'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RuntimeInspectionRenderer } from '@/features/endge-ide/services/runtime-preview/runtime-inspection-renderer'

function host(id: string): RuntimeHostSnapshot {
  return { id, parentId: null, entityType: 'component-sfc', entityIdentity: 'client-table', title: id, basePath: `runtime.${id}`, runtimeType: 'component-sfc-runtime-host', status: 'active', createdAt: 1, updatedAt: 1, removedAt: null, capabilities: ['renderable'], context: {}, resources: [], channels: [], meta: {} }
}

beforeEach(async () => {
  vi.spyOn(Endge.bridge, 'start').mockImplementation(() => {})
  await Endge.boot({ mode: 'debugger', scope: { workspaceIdentity: 'inspection' }, vars: {}, bridge: { role: 'configurator', serverUrl: 'http://localhost:8080', debug: true } })
  const configuration = createDefaultEndgeConfiguration()
  Endge.workspace.applyInspection({ identity: 'inspection', displayName: 'Inspection', startupCompositionIdentity: null, configuration, managedBy: 'user', managedById: null, dataMode: 'live', installedIntegrations: [] })
  Endge.configuration.applyInspection(configuration)
  Endge.domain.replaceFromPlain({ componentSFCs: [{ id: 'client-table', identity: 'client-table', source: '<script setup lang="ts">defineProps<{ rows: Array<{ id: number }> }>()</script><template><Table :rows="rows" row-key="id"><Column key="id" /></Table></template>' }] })
})
afterEach(async () => {
  await Endge.reset()
  vi.restoreAllMocks()
})

describe('визуальное превью наблюдаемого клиента', () => {
  /** Один Domain SFC рендерится для разных runtime bindings, не создавая executing hosts или Program artifacts. */
  it('компилирует Domain и читает разные входы двух экземпляров из снимка Raph', () => {
    const first = host('first')
    const second = host('second')
    let snapshot: RuntimeInspectionSnapshot = {
      version: 1,
      runtime: { generatedAt: 1, hosts: [first, second], scopes: [], total: 2, byStatus: { active: 2 }, deletedTotal: 0, deletedHosts: [] },
      data: { first: [{ id: 1 }], second: [{ id: 2 }] },
      dataGeneratedAt: 1,
      render: { styles: [], hosts: {
        first: { kind: 'component-sfc', input: { kind: 'raph', bindings: { rows: { path: 'first' } } }, computations: [{ identity: 'captured', input: { b: 2, a: 1 }, status: 'success', loading: false, value: 42, error: null }], dataMeta: {} },
        second: { kind: 'component-sfc', input: { kind: 'raph', bindings: { rows: { path: 'second' } } }, computations: [], dataMeta: {} },
      } },
    }
    const execute = vi.spyOn(Endge.runtime, 'execute')
    const computations = vi.spyOn(Endge.computations, 'createResource')
    const addPhase = vi.spyOn(Raph, 'addPhase')
    const renderer = new RuntimeInspectionRenderer(() => snapshot)
    const a = renderer.render(first)
    const b = renderer.render(second)
    expect(a?.kind).toBe('component-sfc')
    expect(b?.kind).toBe('component-sfc')
    if (a?.kind !== 'component-sfc' || b?.kind !== 'component-sfc') {
      throw new Error(JSON.stringify([a, b]))
    }
    expect(a.input.props.rows).toEqual([{ id: 1 }])
    expect(b.input.props.rows).toEqual([{ id: 2 }])
    expect(a.runtime.getComputationResource('captured', { a: 1, b: 2 }, 'different-renderer-id').value).toBe(42)
    expect(a.runtime.getComputationResource('not-captured', {}, 'unused').status).toBe('idle')
    snapshot = { ...snapshot, data: { first: [{ id: 3 }], second: [{ id: 2 }] }, dataGeneratedAt: 2 }
    const updated = renderer.render(first)
    expect(updated).toMatchObject({ kind: 'component-sfc', input: { props: { rows: [{ id: 3 }] } } })
    if (updated?.kind === 'component-sfc') {
      expect(updated.runtime).toBe(a.runtime)
    }
    expect(Endge.runtime.getRuntimeHosts()).toEqual([])
    expect(Endge.program.getArtifact('component-sfc', 'client-table')).toBeNull()
    expect(execute).not.toHaveBeenCalled()
    expect(computations).not.toHaveBeenCalled()
    expect(addPhase).not.toHaveBeenCalled()
    expect(() => a.runtime.beginEditSession('edit', 1)).toThrow('только для чтения')
    renderer.retainHosts([second])
    const recreated = renderer.render(first)
    if (recreated?.kind === 'component-sfc') {
      expect(recreated.runtime).not.toBe(a.runtime)
    }
    renderer.reset()
  })
})
