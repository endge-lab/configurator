/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_API_AUTH_URL?: string
  readonly VITE_FEATURE_FLAGS?: string
  readonly VITE_GIT_SHA?: string
  readonly VITE_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
