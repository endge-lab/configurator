/// <reference types="vite/client" />
import type { Ref } from 'vue'

interface ViteTypeOptions {
  // By adding this line, you can make the type of ImportMetaEnv strict
  // to disallow unknown keys.
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_BRANDING?: string
  readonly VITE_DEFAULT_LOCALE?: string
  readonly VITE_STORAGE_PROVIDER?: string
  readonly VITE_PAYLOAD_BASE_URL?: string
  readonly VITE_PAYLOAD_SECRET?: string
  readonly VITE_ENDPOINT_AUTH?: string
  readonly VITE_APP_SWITCHER?: string
  /** Включить Vite-плагин кодогенерации (endge-codegen). По умолчанию выключен. */
  readonly VITE_ENDGE_CODEGEN_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
declare module 'vue' {
  interface ComponentCustomProperties {
    $branding: Ref<string>
  }
}

declare const __APP_VERSION__: string
declare const __APP_VERSION_UPDATED__: string

declare module 'virtual:endge-codegen-push' {}
