/** Узкий контракт persistence для состояния UI-редактора. */
export interface UIEditorStoragePort {
  readFirst: (keys: readonly string[]) => string | null
  write: (key: string, value: string) => void
}
