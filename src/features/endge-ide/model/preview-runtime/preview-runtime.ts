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

/** Возвращает активную preview entity из scope registry. */
export function resolvePreviewRuntime<T>(
  entityType: RuntimeEntityType,
  identity: string,
): T | null {
  return configuratorPreviewAppScope.resolve<T>(entityType, identity)
}

/** Удаляет preview runtime tree сущности по domain identity. */
export function destroyPreviewRuntime(entityType: RuntimeEntityType, identity: string): void {
  configuratorPreviewAppScope.destroy(entityType, identity)
}

/** Metadata режима Configurator, не участвующая в runtime addressing. */
export function configuratorPreviewMeta(): Record<string, unknown> {
  return {
    mode: 'preview',
    previewScope: CONFIGURATOR_PREVIEW_SCOPE,
  }
}
