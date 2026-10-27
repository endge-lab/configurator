import type { CompositionRuntimeHost, RuntimeHost } from '@endge/core'

const INACTIVE_STATUSES = new Set(['paused', 'pausing', 'stopping', 'stopped', 'unmounted', 'destroyed', 'error'])

export function isPreviewRenderableActive(host: RuntimeHost<any, any>): boolean {
  return !INACTIVE_STATUSES.has(host.status)
}

/**
 * Отображаемые runtime Composition в порядке Source.
 *
 * Активные вложенные Composition раскрываются на месте вызова: страница, собранная
 * из экранов-Composition, показывается целиком, а не только своими прямыми компонентами.
 */
export function collectCompositionRenderables(
  host: CompositionRuntimeHost,
  scopePath?: string | null,
): RuntimeHost<any, any>[] {
  const order = new Map((host.getArtifactPayload()?.runtimes ?? []).map((item, index) => [item.path, index]))
  const position = (path: string): number => order.get(path) ?? Number.MAX_SAFE_INTEGER
  const children = host.getChildren()
    .filter(child => !scopePath || child.descriptor.scopePath === scopePath || child.descriptor.scopePath.startsWith(`${scopePath}.`))
    .sort((left, right) => position(left.descriptor.path) - position(right.descriptor.path))
  const result: RuntimeHost<any, any>[] = []
  for (const child of children) {
    if (!isPreviewRenderableActive(child.runtime)) {
      continue
    }
    if (child.descriptor.kind === 'composition') {
      result.push(...collectCompositionRenderables(child.runtime as CompositionRuntimeHost))
      continue
    }
    if (child.runtime.hasCapability('renderable')) {
      result.push(child.runtime)
    }
  }
  return result
}
