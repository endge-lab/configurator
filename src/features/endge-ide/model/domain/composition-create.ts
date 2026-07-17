import type { RCompositionKind } from '@endge/core'

export interface CompositionCreateOwner {
  kind: RCompositionKind
  identity: string
  displayName?: string
}

export interface CompositionCreatePlacement {
  kind: RCompositionKind
  kindIdentity: string | null
}

/** Resolves canonical Composition placement for every create mode. */
export function resolveCompositionCreatePlacement(options: {
  queryComposition?: boolean
  owner?: CompositionCreateOwner | null
} = {}): CompositionCreatePlacement {
  if (options.owner) {
    const identity = options.owner.identity.trim()
    if (!identity)
      throw new Error('Composition owner identity is required.')
    return {
      kind: options.owner.kind,
      kindIdentity: identity,
    }
  }

  return options.queryComposition
    ? { kind: 'query', kindIdentity: null }
    : { kind: 'library', kindIdentity: null }
}
