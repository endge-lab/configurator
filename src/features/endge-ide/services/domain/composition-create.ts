import type { RCompositionKind } from '@endge/core'

export interface CompositionCreatePlacement {
  kind: RCompositionKind
  kindIdentity: string | null
}

/** Определяет размещение нового самостоятельного документа Composition. */
export function resolveCompositionCreatePlacement(options: {
  queryComposition?: boolean
} = {}): CompositionCreatePlacement {
  return options.queryComposition
    ? { kind: 'query', kindIdentity: null }
    : { kind: 'library', kindIdentity: null }
}
