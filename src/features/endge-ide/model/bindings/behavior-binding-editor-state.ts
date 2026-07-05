import type { EndgeBindingMode } from '@endge/core'

export const BEHAVIOR_BINDING_EDITOR_STATE_KEY = '__behaviorBindingEditorState' as const

export interface BehaviorBindingEditorItemState {
  id: number | null
  identity: string
  displayName: string
  eventName: string
  scriptRef: string
  mode: EndgeBindingMode
  priority: number
  isEnabled: boolean
  environmentId: number | null
  isInherited: boolean
  originBindingId: number | null
}

export interface BehaviorBindingEditorState {
  ownerType: string
  ownerId: number
  targetType: string
  targetId: number
  projectId: number | null
  items: BehaviorBindingEditorItemState[]
}

export function getBehaviorBindingEditorState(editor: unknown): BehaviorBindingEditorState | null {
  if (!editor || typeof editor !== 'object')
    return null
  const state = (editor as Record<string, unknown>)[BEHAVIOR_BINDING_EDITOR_STATE_KEY]
  if (!state || typeof state !== 'object')
    return null
  return state as BehaviorBindingEditorState
}

export function setBehaviorBindingEditorState(editor: unknown, state: BehaviorBindingEditorState): void {
  if (!editor || typeof editor !== 'object')
    return
  ;(editor as Record<string, unknown>)[BEHAVIOR_BINDING_EDITOR_STATE_KEY] = state
}
