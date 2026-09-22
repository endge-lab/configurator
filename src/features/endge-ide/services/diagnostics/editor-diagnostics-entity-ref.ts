import type { DiagnosticsEntityRef } from '@endge/core'

interface DiagnosticsEditorIdentity {
  id?: string | number | null
  identity?: string | null
}

/** Создаёт нормализованную ссылку на редактируемую сущность для Problems registry. */
export function createEditorDiagnosticsEntityRef(
  entityType: string,
  editor: DiagnosticsEditorIdentity | null | undefined,
): DiagnosticsEntityRef | null {
  if (!editor) {
    return null
  }

  const identity = String(editor.identity ?? editor.id ?? '').trim()
  const id = editor.id ?? identity
  if (!identity || id === '') {
    return null
  }

  return {
    entityType: String(entityType).trim(),
    id,
    identity,
  }
}
