import type { Component } from 'vue'

import { markRaw } from 'vue'

import BearerAuthProfileEditor from '@/features/endge-ide/ui/section/document/entity/auth-profile-adapters/BearerAuthProfileEditor.vue'
import KeycloakAuthProfileEditor from '@/features/endge-ide/ui/section/document/entity/auth-profile-adapters/KeycloakAuthProfileEditor.vue'

export interface AuthProfileAdapterEditorRegistration {
  id: string
  label: string
  editor: Component
  defaults?: {
    config?: Record<string, unknown>
    credentialRefs?: Record<string, unknown>
  }
}

const BUILTIN_AUTH_PROFILE_EDITORS: AuthProfileAdapterEditorRegistration[] = [
  {
    id: 'keycloak',
    label: 'Keycloak',
    editor: KeycloakAuthProfileEditor,
    defaults: {
      config: {
        loginMode: 'interactive',
        baseUrl: '',
        clientId: '',
        scope: 'openid profile email',
        refreshSkewMs: 30_000,
        tokenPath: '/token',
        logoutPath: '/logout',
        userinfoPath: '/userinfo',
      },
      credentialRefs: {},
    },
  },
  {
    id: 'bearer',
    label: 'Bearer token',
    editor: BearerAuthProfileEditor,
    defaults: {
      config: {},
      credentialRefs: { token: '' },
    },
  },
]

/** Owns the extensible mapping from auth profile adapters to Vue editors. */
export class AuthProfileEditorRegistry_Module {
  private readonly _editors = new Map<string, AuthProfileAdapterEditorRegistration>()

  public constructor() {
    this.reset()
  }

  public register(registration: AuthProfileAdapterEditorRegistration): void {
    const id = String(registration.id ?? '').trim()
    if (!id) {
      throw new Error('[AuthProfileEditorRegistry] id is required')
    }

    this._editors.set(id, {
      ...registration,
      id,
      editor: markRaw(registration.editor),
    })
  }

  public get(adapterId: string | null | undefined): AuthProfileAdapterEditorRegistration | null {
    const id = String(adapterId ?? '').trim()
    return id ? this._editors.get(id) ?? null : null
  }

  public list(): AuthProfileAdapterEditorRegistration[] {
    return Array.from(this._editors.values())
  }

  public reset(): void {
    this._editors.clear()
    for (const registration of BUILTIN_AUTH_PROFILE_EDITORS) {
      this.register(registration)
    }
  }
}
