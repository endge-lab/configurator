import type { ProgramArtifact, RuntimeArtifactReader } from '@endge/core'

import { describe, expect, it } from 'vitest'

import { createRuntimePreviewArtifactReader } from '@/features/endge-ide/services/runtime-preview/runtime-preview-data-mode'

describe('политика режима данных Runtime Preview', () => {
  it('накладывает режим данных Composition без изменения скомпилированного артефакта', () => {
    const composition = artifact('composition', { dataMode: 'live' })
    const query = artifact('query', { type: 'query-rest' })
    const reader = createRuntimePreviewArtifactReader(createReader(composition, query), true)

    expect(reader.getArtifact<{ dataMode: string }>('composition', 'entry')?.payload.dataMode).toBe('mock')
    expect(composition.payload.dataMode).toBe('live')
    expect(reader.getArtifact('query', 'flights')).toBe(query)
  })

  it('сохраняет исходный reader артефакта в live preview', () => {
    const reader = createReader(artifact('composition', { dataMode: 'live' }))

    expect(createRuntimePreviewArtifactReader(reader, false)).toBe(reader)
  })
})

function createReader(...artifacts: ProgramArtifact[]): RuntimeArtifactReader {
  return {
    getArtifact: <TPayload>(entityType: Parameters<RuntimeArtifactReader['getArtifact']>[0], id: string | number) => (artifacts.find(item =>
      item.ref.entityType === entityType && (String(item.ref.id) === String(id) || item.ref.identity === String(id)),
    ) ?? null) as ProgramArtifact<TPayload> | null,
  }
}

function artifact(entityType: 'composition' | 'query', payload: Record<string, unknown>): ProgramArtifact<Record<string, unknown>> {
  return {
    ref: { entityType, id: entityType === 'composition' ? 'entry' : 'flights', identity: entityType === 'composition' ? 'entry' : 'flights' },
    sourceHash: entityType,
    compilerVersion: 'test',
    status: 'valid',
    diagnostics: [],
    dependencies: [],
    capabilities: [],
    metadata: { self: {}, nodes: [] },
    payload,
  }
}
