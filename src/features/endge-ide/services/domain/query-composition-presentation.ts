import { Endge } from '@endge/core'

export const QUERY_COMPOSITION_CREATE_KIND = 'query-composition' as const
export const QUERY_COMPOSITION_PRESENTATION_KIND = 'query-composition' as const
export const QUERY_COMPOSITION_ROLE = 'query-composition' as const
export const QUERY_ROOT_IDENTITY = 'root-queries' as const
export const COMPOSITION_ROOT_IDENTITY = 'root-compositions' as const

interface EntityWithMeta {
  meta?: Record<string, unknown> | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

/** Определяет presentation-роль Composition без изменения ее доменного типа. */
export function isQueryComposition(entity: EntityWithMeta | null | undefined): boolean {
  const endgeMeta = isRecord(entity?.meta) && isRecord(entity.meta.endge)
    ? entity.meta.endge
    : null
  return endgeMeta?.role === QUERY_COMPOSITION_ROLE
}

/** Добавляет или удаляет query presentation-роль, сохраняя остальные meta-поля. */
export function setQueryCompositionRole(
  meta: Record<string, unknown> | null | undefined,
  enabled: boolean,
): Record<string, unknown> {
  const next = isRecord(meta) ? { ...meta } : {}
  const endgeMeta = isRecord(next.endge) ? { ...next.endge } : {}

  if (enabled) {
    endgeMeta.role = QUERY_COMPOSITION_ROLE
    next.endge = endgeMeta
    return next
  }

  delete endgeMeta.role
  if (Object.keys(endgeMeta).length) {
    next.endge = endgeMeta
  }
  else {
    delete next.endge
  }
  return next
}

/** Возвращает id системного корня запросов для связи Payload folder. */
export function getQueryRootFolderId(): string | number | null {
  return Endge.domain.getFolderByIdentity(QUERY_ROOT_IDENTITY)?.id ?? null
}

/** Возвращает id системного корня композиций для связи Payload folder. */
export function getCompositionRootFolderId(): string | number | null {
  return Endge.domain.getFolderByIdentity(COMPOSITION_ROOT_IDENTITY)?.id ?? null
}
