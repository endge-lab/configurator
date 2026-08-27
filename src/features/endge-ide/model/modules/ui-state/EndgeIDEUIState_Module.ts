interface UIStateStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

type UIStateStorageResolver = () => UIStateStorage | null

function resolveBrowserLocalStorage(): UIStateStorage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  }
  catch {
    return null
  }
}

/** Централизованно управляет persistent UI state текущего IDE runtime. */
export class EndgeIDEUIState_Module {
  private readonly _resolveStorage: UIStateStorageResolver

  /**
   * --------------------
   * PUBLIC
   * --------------------
   */

  public constructor(resolveStorage: UIStateStorageResolver = resolveBrowserLocalStorage) {
    this._resolveStorage = resolveStorage
  }

  /** Возвращает сохранённое значение или переданное fallback-значение. */
  public read<T>(key: string, fallback: T): T {
    try {
      const raw = this._resolveStorage()?.getItem(key)
      return raw == null ? fallback : JSON.parse(raw) as T
    }
    catch {
      return fallback
    }
  }

  /** Сохраняет сериализуемое UI-состояние. */
  public write(key: string, value: unknown): void {
    try {
      this._resolveStorage()?.setItem(key, JSON.stringify(value))
    }
    catch {
      // Persistent UI state работает в best-effort режиме.
    }
  }

  /** Удаляет сохранённое UI-состояние. */
  public remove(key: string): void {
    try {
      this._resolveStorage()?.removeItem(key)
    }
    catch {
      // Persistent UI state работает в best-effort режиме.
    }
  }
}
