import type { WorkflowLayout, WorkflowPoint } from '../domain/ProjectWorkflow'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Отсутствующая раскладка означает auto layout; неизвестный формат остаётся read-only. */
export function readWorkflowLayout(meta: Record<string, unknown>): WorkflowLayout | null {
  const configurator = meta.configurator
  if (configurator == null) {
    return { schemaVersion: 1, positions: {} }
  }
  if (!isRecord(configurator)) {
    return null
  }
  const layout = configurator.workflow
  if (layout == null) {
    return { schemaVersion: 1, positions: {} }
  }
  if (!isRecord(layout) || layout.schemaVersion !== 1 || !isRecord(layout.positions)) {
    return null
  }
  const positions: [string, WorkflowPoint][] = []
  for (const [id, point] of Object.entries(layout.positions)) {
    if (!isRecord(point) || typeof point.x !== 'number' || typeof point.y !== 'number'
      || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return null
    }
    positions.push([id, { x: point.x, y: point.y }])
  }
  return { schemaVersion: 1, positions: Object.fromEntries(positions) }
}

/** Записывает только namespace раскладки, сохраняя чужие поля meta и configurator. */
export function writeWorkflowLayout(
  meta: Record<string, unknown>,
  layout: WorkflowLayout | null,
): Record<string, unknown> {
  if (!layout) {
    return meta
  }
  const configurator = isRecord(meta.configurator) ? meta.configurator : {}
  if (configurator.workflow == null && Object.keys(layout.positions).length === 0) {
    return meta
  }
  return {
    ...meta,
    configurator: {
      ...configurator,
      workflow: { ...layout },
    },
  }
}
