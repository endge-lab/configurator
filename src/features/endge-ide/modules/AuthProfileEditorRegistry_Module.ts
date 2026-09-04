import type { Component } from 'vue'

import { markRaw } from 'vue'

import BasicAuthProfileEditor from '@/features/endge-ide/ui/section/document/entity/auth-profile-adapters/BasicAuthProfileEditor.vue'
import BearerAuthProfileEditor from '@/features/endge-ide/ui/section/document/entity/auth-profile-adapters/BearerAuthProfileEditor.vue'
import OAuth2ClientCredentialsAuthProfileEditor from '@/features/endge-ide/ui/section/document/entity/auth-profile-adapters/OAuth2ClientCredentialsAuthProfileEditor.vue'
import OAuth2PasswordAuthProfileEditor from '@/features/endge-ide/ui/section/document/entity/auth-profile-adapters/OAuth2PasswordAuthProfileEditor.vue'
import OidcAuthProfileEditor from '@/features/endge-ide/ui/section/document/entity/auth-profile-adapters/OidcAuthProfileEditor.vue'

export interface AuthProfileAdapterEditorRegistration {
  id: string
  label: string
  editor: Component
  defaults?: {
    config?: Record<string, unknown>
    credentials?: Record<string, unknown>
  }
}

const BUILTIN_AUTH_PROFILE_EDITORS: AuthProfileAdapterEditorRegistration[] = [
  {
    id: 'oidc',
    label: 'OIDC',
    editor: OidcAuthProfileEditor,
    defaults: {
      config: {
        issuer: '{OIDC_ISSUER}',
        clientId: 'endge-configurator',
        scopes: ['openid', 'profile'],
      },
      credentials: {},
    },
  },
  {
    id: 'oauth2-client-credentials',
    label: 'OAuth2 Client Credentials',
    editor: OAuth2ClientCredentialsAuthProfileEditor,
    defaults: {
      config: { tokenEndpoint: '', clientId: '', scopes: [], clientAuthentication: 'client_secret_basic' },
      credentials: { clientSecret: '' },
    },
  },
  {
    id: 'oauth2-password',
    label: 'OAuth2 Password (dev/test)',
    editor: OAuth2PasswordAuthProfileEditor,
    defaults: {
      config: { tokenEndpoint: '{KEYCLOAK_TOKEN_ENDPOINT}', clientId: 'hub-public', scopes: ['openid', 'email'] },
      credentials: { username: '', password: '' },
    },
  },
  {
    id: 'basic',
    label: 'Basic',
    editor: BasicAuthProfileEditor,
    defaults: { config: {}, credentials: { username: '', password: '' } },
  },
  {
    id: 'bearer',
    label: 'Bearer token',
    editor: BearerAuthProfileEditor,
    defaults: {
      config: {},
      credentials: { token: '' },
    },
  },
]

/** Владеет расширяемым сопоставлением адаптеров профиля авторизации с Vue-редакторами. */
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
