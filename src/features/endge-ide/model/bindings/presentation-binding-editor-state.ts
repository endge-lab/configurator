import type { EndgeBindingMode } from '@endge/core'

export const PRESENTATION_BINDING_EDITOR_STATE_KEY = '__presentationBindingEditorState' as const

export interface PresentationBindingEditorItemState {
  id: number | null
  identity: string
  displayName: string
  role: string
  rendererRef: string
  when: string | null
  mode: EndgeBindingMode
  priority: number
  isEnabled: boolean
  environmentId: number | null
  isInherited: boolean
  originBindingId: number | null
}

export interface PresentationBindingEditorState {
  ownerType: string
  ownerId: number
  targetType: string
  targetId: number
  projectId: number | null
  items: PresentationBindingEditorItemState[]
}

export function getPresentationBindingEditorState(editor: unknown): PresentationBindingEditorState | null {
  if (!editor || typeof editor !== 'object')
    return null
  const state = (editor as Record<string, unknown>)[PRESENTATION_BINDING_EDITOR_STATE_KEY]
  if (!state || typeof state !== 'object')
    return null
  return state as PresentationBindingEditorState
}

export function setPresentationBindingEditorState(editor: unknown, state: PresentationBindingEditorState): void {
  if (!editor || typeof editor !== 'object')
    return
  ;(editor as Record<string, unknown>)[PRESENTATION_BINDING_EDITOR_STATE_KEY] = state
}
