import type { RuntimePreviewLaunchRequest } from '@/features/endge-ide/domain/types/runtime-preview.types'
import type { DomainDocumentType } from '@endge/core'

import { RComponentSFCEditor } from '@/features/endge-ide/domain/entities/RComponentSFCEditor'
import { RCompositionEditor } from '@/features/endge-ide/domain/entities/RCompositionEditor'
import { RProjectEditor } from '@/features/endge-ide/domain/entities/RProjectEditor'
import { RStoreEditor } from '@/features/endge-ide/domain/entities/RStoreEditor'

export interface RuntimePreviewDocumentReference {
  docType: DomainDocumentType
  identity?: string | null
}

/** Maps a persisted project-tree document to the same runtime target used by its editor. */
export function createRuntimePreviewLaunchRequestFromDocument(
  document: RuntimePreviewDocumentReference,
): RuntimePreviewLaunchRequest | null {
  const identity = String(document.identity ?? '').trim()
  if (!identity) {
    return null
  }

  switch (document.docType) {
    case 'project':
      return { entityType: 'project', identity }
    case 'composition':
      return { entityType: 'composition', identity }
    case 'component-sfc':
      return { entityType: 'component-sfc', identity }
    case 'store':
      return { entityType: 'store', identity }
    default:
      return null
  }
}

/** Maps only documents with an executable runtime contract to a launch request. */
export function createRuntimePreviewLaunchRequest(editor: unknown): RuntimePreviewLaunchRequest | null {
  if (editor instanceof RProjectEditor) {
    return {
      entityType: 'project',
      identity: editor.identity,
    }
  }

  if (editor instanceof RComponentSFCEditor) {
    return {
      entityType: 'component-sfc',
      identity: editor.identity,
      draft: {
        id: editor.id,
        identity: editor.identity,
        tag: editor.tag,
        name: editor.name,
        displayName: editor.displayName,
        source: editor.source,
      },
    }
  }

  if (editor instanceof RCompositionEditor) {
    return {
      entityType: 'composition',
      identity: editor.identity,
      draft: {
        id: editor.id,
        identity: editor.identity,
        name: editor.name,
        displayName: editor.name,
        source: editor.source,
        sourceVersion: editor.sourceVersion,
      },
    }
  }

  if (editor instanceof RStoreEditor) {
    return {
      entityType: 'store',
      identity: editor.identity,
      draft: {
        id: editor.id,
        identity: editor.identity,
        name: editor.name,
        displayName: editor.name,
        source: editor.source,
        sourceVersion: editor.sourceVersion,
      },
    }
  }

  return null
}
