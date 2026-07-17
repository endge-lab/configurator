import type { RuntimeEntityType } from '@endge/core'

import { Endge } from '@endge/core'

export const CONFIGURATOR_PREVIEW_SCOPE = 'preview'

/** Общий runtime root всех запускаемых из Configurator preview entities. */
export const configuratorPreviewAppScope = Endge.runtime.createAppScope({
  id: CONFIGURATOR_PREVIEW_SCOPE,
  rootPath: 'runtime-preview',
  collisionPolicy: 'replace',
  persistence: 'disabled',
})

const lifecycleQueues = new Map<RuntimeEntityType, Promise<void>>()

/** Сериализует start/stop одного singleton preview, включая полный teardown. */
export function serializePreviewLifecycle<T>(
  entityType: RuntimeEntityType,
  operation: () => Promise<T> | T,
): Promise<T> {
  const previous = lifecycleQueues.get(entityType) ?? Promise.resolve()
  const result = previous.catch(() => {}).then(operation)
  const settled = result.then(() => {}, () => {})
  lifecycleQueues.set(entityType, settled)
  void settled.finally(() => {
    if (lifecycleQueues.get(entityType) === settled) {
      lifecycleQueues.delete(entityType)
    }
  })
  return result
}

/** Возвращает активную preview entity из scope registry. */
export function resolvePreviewRuntime<T>(
  entityType: RuntimeEntityType,
  identity: string,
): T | null {
  return configuratorPreviewAppScope.resolve<T>(entityType, identity)
}

/** Удаляет preview runtime tree сущности по domain identity. */
export async function destroyPreviewRuntime(entityType: RuntimeEntityType, identity: string): Promise<void> {
  await configuratorPreviewAppScope.destroyAsync(entityType, identity)
}

/** Metadata режима Configurator, не участвующая в runtime addressing. */
export function configuratorPreviewMeta(): Record<string, unknown> {
  return {
    mode: 'preview',
    previewScope: CONFIGURATOR_PREVIEW_SCOPE,
  }
}
