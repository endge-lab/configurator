import type { Component } from 'vue'

import { markRaw } from 'vue'

import KeycloakFormAuthProfileEditor from '@/features/endge-ide/ui/section/document/entity/auth-profile-adapters/KeycloakFormAuthProfileEditor.vue'
import KeycloakManualAuthProfileEditor from '@/features/endge-ide/ui/section/document/entity/auth-profile-adapters/KeycloakManualAuthProfileEditor.vue'
import ManualTokenAuthProfileEditor from '@/features/endge-ide/ui/section/document/entity/auth-profile-adapters/ManualTokenAuthProfileEditor.vue'

export interface AuthProfileAdapterEditorRegistration {
  id: string
  label: string
  editor: Component
  defaults?: {
    config?: Record<string, unknown>
    credentialRefs?: Record<string, unknown>
  }
}

const adapterEditors = new Map<string, AuthProfileAdapterEditorRegistration>()

export function registerAuthProfileAdapterEditor(
  registration: AuthProfileAdapterEditorRegistration,
): void {
  const id = String(registration.id ?? '').trim()
  if (!id)
    throw new Error('[registerAuthProfileAdapterEditor] id is required')

  adapterEditors.set(id, {
    ...registration,
    id,
    editor: markRaw(registration.editor),
  })
}

export function getAuthProfileAdapterEditor(
  adapterId: string | null | undefined,
): AuthProfileAdapterEditorRegistration | null {
  const id = String(adapterId ?? '').trim()
  if (!id)
    return null
  return adapterEditors.get(id) ?? null
}

export function getAuthProfileAdapterEditors(): AuthProfileAdapterEditorRegistration[] {
  return Array.from(adapterEditors.values())
}

registerAuthProfileAdapterEditor({
  id: 'keycloak_form',
  label: 'Keycloak (form)',
  editor: KeycloakFormAuthProfileEditor,
  defaults: {
    config: {
      KeycloakBaseUrl: '',
      storageKey: '',
      clientId: '',
      scope: '',
      refreshSkewMs: '',
      tokenPath: '',
      logoutPath: '',
    },
  },
})

registerAuthProfileAdapterEditor({
  id: 'keycloak_manual',
  label: 'Keycloak (manual)',
  editor: KeycloakManualAuthProfileEditor,
  defaults: {
    config: {
      KeycloakBaseUrl: '',
      storageKey: '',
      clientId: '',
      scope: '',
      refreshSkewMs: '',
      tokenPath: '',
      logoutPath: '',
      login: '',
      password: '',
    },
  },
})

registerAuthProfileAdapterEditor({
  id: 'manual_token',
  label: 'Manual token',
  editor: ManualTokenAuthProfileEditor,
  defaults: {
    config: {
      manualToken: '',
    },
  },
})
