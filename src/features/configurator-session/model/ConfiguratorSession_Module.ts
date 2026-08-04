import type {
  ConfiguratorSessionService,
  ConfiguratorSessionState,
} from '@/features/configurator-session/domain/types/configurator-session.type'

/** Единственный владелец состояния developer session Configurator. */
export class ConfiguratorSession_Module {
  private _state: ConfiguratorSessionState = { status: 'idle' }
  private _checkPromise: Promise<ConfiguratorSessionState> | null = null
  private readonly _listeners = new Set<() => void>()

  public constructor(private readonly _service: ConfiguratorSessionService) {}

  public get state(): ConfiguratorSessionState {
    return this._state
  }

  /** Проверяет session с single-flight защитой. */
  public async check(): Promise<ConfiguratorSessionState> {
    if (this._checkPromise) {
      return this._checkPromise
    }

    this._setState({ status: 'checking' })
    this._checkPromise = this._service.check()
      .then((state) => {
        this._setState(state)
        return state
      })
      .finally(() => {
        this._checkPromise = null
      })
    return this._checkPromise
  }

  /** Завершает developer session и очищает локальный snapshot. */
  public async logout(): Promise<void> {
    try {
      await this._service.logout()
    }
    finally {
      this.reset()
    }
  }

  /** Сбрасывает module state без сетевого запроса. */
  public reset(): void {
    this._setState({ status: 'idle' })
  }

  /** Подписывает presentation adapter на изменения session state. */
  public subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  private _setState(state: ConfiguratorSessionState): void {
    this._state = state
    for (const listener of this._listeners) {
      listener()
    }
  }
}
