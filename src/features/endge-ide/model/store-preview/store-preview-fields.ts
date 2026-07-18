import type { DataViewRef, StoreRuntimeHost } from '@endge/core'

export interface StorePreviewFieldSnapshot {
  key: string
  kind: 'value' | 'derived'
  source: string | null
  dataViews: string[]
  initializer: string | null
  mockIdentity: string | null
  raphPath: string
  value: unknown
}

/** Reads canonical live Store fields together with their Raph addresses. */
export function readStorePreviewFields(runtime: StoreRuntimeHost): StorePreviewFieldSnapshot[] {
  const snapshot = runtime.getDataSnapshot()

  return runtime.getFields().map(field => ({
    key: field.key,
    kind: field.kind,
    source: field.kind === 'derived' ? field.source : null,
    dataViews: field.kind === 'derived'
      ? field.dataViews.map(dataViewLabel)
      : [],
    initializer: field.kind === 'value' ? field.initial.kind : null,
    mockIdentity: field.kind === 'value' && field.initial.kind === 'mock'
      ? field.initial.identity
      : null,
    raphPath: runtime.getDataPath(field.key),
    value: snapshot[field.key],
  }))
}

function dataViewLabel(ref: DataViewRef): string {
  if (ref.kind === 'external') {
    return ref.identity
  }
  if (ref.kind === 'local') {
    return ref.ref.identity
  }
  return 'inline'
}
