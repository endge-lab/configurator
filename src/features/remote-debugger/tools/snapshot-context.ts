import type { DiagnosticsSnapshot, EndgeContextSnapshot } from '@endge/core'

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

/** Читает значения наблюдаемого Context отдельно от авторизации и настроек разработчика. */
export function readSnapshotContext(snapshot: DiagnosticsSnapshot): Readonly<Partial<EndgeContextSnapshot>> {
  const nodes = record(snapshot.federation)?.nodes
  const node = Array.isArray(nodes) ? nodes.map(record).find(node => node?.kind === 'module' && node.key === 'context' && node.status === 'captured') : null
  const context = record(node?.snapshot)
  if (!context) {
    return {}
  }
  const keys: (keyof EndgeContextSnapshot)[] = ['workspace', 'tenant', 'project', 'environment', 'user', 'locale', 'theme', 'timezone']
  return Object.fromEntries(keys.map(key => [key, typeof context[key] === 'string' ? context[key] : null]))
}
