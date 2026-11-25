import type { CompositionProgramPayload, I18nRuntimeCatalog } from '@endge/core'
import { compositionI18nCatalogs, Endge } from '@endge/core'

export function componentPreviewTranslation(componentIdentity: string) {
  const startup = Endge.workspace.current.startupCompositionIdentity
  const owners = Endge.program.getArtifacts().flatMap((artifact) => {
    if (artifact.ref.entityType !== 'composition' || artifact.status === 'error') {
      return []
    }
    const payload = artifact.payload as CompositionProgramPayload
    const scopes = payload.runtimes.flatMap(runtime => runtime.kind === 'component' && runtime.identity === componentIdentity
      ? [runtime.scopePath]
      : [])
    const identity = artifact.ref.identity
    return scopes.length && identity ? [{ identity, scopes }] : []
  })

  const catalogs: I18nRuntimeCatalog[] = []
  const standaloneCatalogs: I18nRuntimeCatalog[] = []
  for (const owner of owners) {
    const inStartup = startup
      ? compositionI18nCatalogs({
          artifacts: Endge.program,
          rootIdentities: [startup],
          targetIdentity: owner.identity,
        })
      : []
    const occurrences = inStartup.length
      ? inStartup
      : compositionI18nCatalogs({
          artifacts: Endge.program,
          rootIdentities: [owner.identity],
          targetIdentity: owner.identity,
        })
    const result = inStartup.length ? catalogs : standaloneCatalogs
    for (const occurrence of occurrences) {
      for (const scope of owner.scopes) {
        const catalog = occurrence.catalogsByScope[scope]
        if (catalog) {
          result.push(catalog)
        }
      }
    }
  }

  // In an isolated preview, use the startup component placement when available.
  // Conflicting placements keep the fallback supplied by the authored expression.
  const candidates = catalogs.length ? catalogs : standaloneCatalogs
  return (key: string, fallback?: string): string | undefined => {
    const missing = '\u0000'
    const translations = new Set(candidates.map(catalog => Endge.i18n.translate(catalog, key, missing)).filter(value => value !== missing))
    return translations.size === 1 ? translations.values().next().value : fallback
  }
}
