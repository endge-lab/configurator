import { Endge } from '@endge/core'

/** Централизованно управляет persistent UI state текущего IDE runtime. */
export class EndgeIDEUIState_Module {
  private readonly _debuggerState = new Map<string, unknown>()

  public clearDebuggerState(): void {
    this._debuggerState.clear()
  }

  /** Возвращает сохранённое значение или переданное fallback-значение. */
  public read<T>(key: string, fallback: T): T {
    if (Endge.mode === 'debugger') {
      return (this._debuggerState.get(key) as T | undefined) ?? fallback
    }
    return Endge.context.getState<T>(key) ?? fallback
  }

  /** Сохраняет сериализуемое UI-состояние. */
  public write(key: string, value: unknown): void {
    if (Endge.mode === 'debugger') {
      this._debuggerState.set(key, value)
      return
    }
    Endge.context.setState(key, value)
  }

  /** Удаляет сохранённое UI-состояние. */
  public remove(key: string): void {
    if (Endge.mode === 'debugger') {
      this._debuggerState.delete(key)
      return
    }
    Endge.context.removeState(key)
  }

  /** Однократно переносит первый найденный legacy localStorage key в context state. */
  public migrateLegacy(key: string, legacyKeys: readonly string[]): void {
    if (Endge.mode === 'debugger') {
      return
    }
    if (Endge.context.getState(key) !== undefined || typeof window === 'undefined') {
      return
    }
    for (const legacyKey of legacyKeys) {
      try {
        const raw = window.localStorage.getItem(legacyKey)
        if (raw == null) {
          continue
        }
        Endge.context.setState(key, JSON.parse(raw))
        if (Endge.context.getState(key) !== undefined) {
          window.localStorage.removeItem(legacyKey)
        }
        return
      }
      catch {
        // Повреждённое legacy-состояние не должно блокировать IDE.
      }
    }
  }
}
