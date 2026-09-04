import type {
  CompositionProgramPayload,
  ProgramArtifact,
  RuntimeArtifactReader,
  SourceLanguageI18nContext,
} from '@endge/core'

import {
  Endge,
  projectCompositionI18nCatalogs,
  RComposition,
} from '@endge/core'

export interface CompositionI18nContextInput {
  documentId: string | number | undefined
  identity: string | undefined
  source: string
}

/**
 * Определяет контекст переводов редактора из текущего Project и временного
 * артефакта Composition. Ожидаемые ошибки черновика не возвращают подсказок;
 * неожиданные ошибки проекции журналируются и не выходят в lifecycle редактора.
 */
export function resolveCompositionI18nContext(
  input: CompositionI18nContextInput,
): SourceLanguageI18nContext | undefined {
  try {
    const persisted = input.documentId == null
      ? Endge.domain.getComposition(String(input.identity ?? '').trim())
      : Endge.domain.getComposition(input.documentId)
    if (!persisted) {
      return undefined
    }

    const draft = RComposition.fromPlain({
      id: persisted.id,
      identity: persisted.identity,
      name: persisted.name,
      displayName: persisted.displayName,
      description: persisted.description,
      folderId: persisted.folderId,
      active: persisted.active,
      kind: persisted.kind,
      kindIdentity: persisted.kindIdentity,
      source: input.source,
      sourceVersion: persisted.sourceVersion,
    })
    const artifact = Endge.compiler.compileCompositionArtifact(draft)
    if (artifact.status === 'error') {
      return undefined
    }

    const projectIdentity = Endge.context.getCurrentProject()
    const rootIdentities = Endge.domain.getCompositions()
      .filter(item => item.kind === 'project'
        && item.kindIdentity === projectIdentity
        && item.active !== false
        && !item.deletedAt)
      .map(item => item.identity)
      .sort((left, right) => left.localeCompare(right))
    const occurrences = projectCompositionI18nCatalogs({
      artifacts: createOverlayArtifactReader(artifact),
      rootIdentities,
      targetIdentity: persisted.identity,
    })
    if (!occurrences.length) {
      return undefined
    }

    return {
      locale: Endge.context.currentLocale,
      fallbackLocale: Endge.configuration.isResolved
        ? Endge.configuration.current.fallbackLocale
        : Endge.workspace.fallbackLocale,
      occurrences: occurrences.map(occurrence => ({
        id: occurrence.id,
        catalogsByScope: occurrence.catalogsByScope,
        provenanceByScope: occurrence.provenanceByScope,
      })),
    }
  }
  catch (error) {
    console.warn('[CompositionI18nHints] Translation context is unavailable.', error)
    return undefined
  }
}

function createOverlayArtifactReader(
  root: ProgramArtifact<CompositionProgramPayload>,
): RuntimeArtifactReader {
  return {
    getArtifact: <TPayload>(entityType: Parameters<RuntimeArtifactReader['getArtifact']>[0], id: string | number) => {
      const matchesRoot = entityType === root.ref.entityType
        && (String(id) === String(root.ref.id) || String(id) === root.ref.identity)
      return (matchesRoot ? root : Endge.program.getArtifact(entityType, id)) as ProgramArtifact<TPayload> | null
    },
  }
}
