import type {
  CompositionProgramPayload,
  ProgramArtifact,
  RuntimeArtifactReader,
  SourceLanguageI18nContext,
} from '@endge/core'

import {
  compositionI18nCatalogs,
  Endge,
  RComposition,
} from '@endge/core'

export interface CompositionI18nContextInput {
  documentType?: 'composition'
  documentId: string | number | undefined
  identity: string | undefined
  source: string
}

/**
 * Определяет контекст переводов редактора из startup Composition и временного
 * артефакта Composition. Ожидаемые ошибки черновика не возвращают подсказок;
 * неожиданные ошибки проекции журналируются и не выходят в lifecycle редактора.
 */
export function resolveCompositionI18nContext(
  input: CompositionI18nContextInput,
): SourceLanguageI18nContext | undefined {
  if (Endge.mode === 'debugger') {
    return undefined
  }
  try {
    const id = input.documentId ?? String(input.identity ?? '').trim()
    const persisted = Endge.domain.getComposition(id)
    if (!persisted) {
      return undefined
    }
    const plain = { ...persisted, source: input.source }
    const artifact = Endge.compiler.compileCompositionArtifact(RComposition.fromPlain(plain))
    if (artifact.status === 'error') {
      return undefined
    }

    const rootIdentity = Endge.workspace.current.startupCompositionIdentity
    if (!rootIdentity) {
      return undefined
    }
    const occurrences = compositionI18nCatalogs({
      artifacts: createOverlayArtifactReader(artifact),
      rootIdentities: [rootIdentity],
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
