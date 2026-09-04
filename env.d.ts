/// <reference types="vite/client" />
interface ViteTypeOptions {
  // Эта строка позволяет сделать тип ImportMetaEnv строгим
  // и запретить неизвестные ключи.
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_DEFAULT_LOCALE?: string
  readonly VITE_ENDGE_SERVICE_BACKEND_URL?: string
  readonly VITE_ENDGE_WORKSPACE_IDENTITY?: string
  readonly VITE_ENDGE_TENANT_IDENTITY?: string
  readonly VITE_ENDGE_PROJECT_IDENTITY?: string
  readonly VITE_ENDGE_ENVIRONMENT_IDENTITY?: string
  readonly VITE_ENDPOINT_AUTH?: string
  readonly VITE_OIDC_ISSUER?: string
  readonly VITE_DOCUMENTATION_URL?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_ENVIRONMENT?: string
  readonly VITE_SENTRY_RELEASE?: string
  readonly VITE_APP_SWITCHER?: string
  /** Включить Vite-плагин кодогенерации (endge-codegen). По умолчанию выключен. */
  readonly VITE_ENDGE_CODEGEN_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
declare const __APP_VERSION__: string
declare const __APP_VERSION_UPDATED__: string

declare module 'virtual:endge-codegen-push' {}
