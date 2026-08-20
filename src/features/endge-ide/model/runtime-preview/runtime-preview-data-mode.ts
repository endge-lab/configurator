import type { RuntimeArtifactReader } from '@endge/core'

/** Preview-only policy: global mock wins over source-local Composition live overrides. */
export function createRuntimePreviewArtifactReader(
  base: RuntimeArtifactReader,
  forceMock: boolean,
): RuntimeArtifactReader {
  if (!forceMock) {
    return base
  }
  return {
    getArtifact: <TPayload>(entityType: Parameters<RuntimeArtifactReader['getArtifact']>[0], id: string | number) => {
      const artifact = base.getArtifact<TPayload>(entityType, id)
      if (!artifact || entityType !== 'composition') {
        return artifact
      }
      return {
        ...artifact,
        payload: {
          ...(artifact.payload as Record<string, unknown>),
          dataMode: 'mock',
        } as TPayload,
      }
    },
  }
}
