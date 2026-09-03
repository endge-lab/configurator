import type { ShallowRef } from 'vue'
import type { ConfiguratorDiagnosticsStorage_Adapter } from '@/app/adapters/ConfiguratorDiagnosticsStorage_Adapter'

import type {
  ConfiguratorDiagnosticsConfig,
  ConfiguratorRenderFailure,
  ConfiguratorRenderGuardState,
} from '@/app/domain/types/configurator-diagnostics.type'
import { shallowRef } from 'vue'

export class ConfiguratorDiagnostics_Module {
  /** Error window, render guard и injected capabilities. */
  private readonly _recentErrorTimestamps: number[] = []
  private readonly _renderGuard = shallowRef<ConfiguratorRenderGuardState | null>(null)
  private readonly _config: ConfiguratorDiagnosticsConfig
  private readonly _shutdownEndgeIDE: () => void
  private readonly _storage: ConfiguratorDiagnosticsStorage_Adapter

  /**
   * ----------------------------------------
   * PUBLIC
   * ----------------------------------------
   */

  public constructor(
    config: ConfiguratorDiagnosticsConfig,
    shutdownEndgeIDE: () => void,
    storage: ConfiguratorDiagnosticsStorage_Adapter,
  ) {
    this._config = config
    this._shutdownEndgeIDE = shutdownEndgeIDE
    this._storage = storage
  }

  /** Фиксирует критическую render failure и включает guard при достижении порога. */
  public capture(params: ConfiguratorRenderFailure): ConfiguratorRenderGuardState | null {
    if (this._renderGuard.value) {
      return this._renderGuard.value
    }

    const now = Date.now()
    const hits = this._recordRecentError(now)
    const error = this._normalizeError(params.err)
    const errorInfo = String(params.errorInfo ?? '')
    const componentName = String(params.componentName ?? 'Unknown')
    const routePath = String(params.routePath ?? '')
    const isRecursive = this._looksLikeRecursiveVueUpdate(error)
    const isErrorStorm = hits >= this._config.errorStormLimit

    if (!isRecursive && !isErrorStorm) {
      return null
    }

    if (params.isEndgeIDE) {
      this._clearEndgeIDEPersistedState()
      this._shutdownEndgeIDE()
    }

    this._renderGuard.value = {
      error,
      errorInfo,
      componentName,
      routePath,
      reason: isRecursive ? 'recursive-updates' : 'error-storm',
      hits,
      triggeredAt: new Date(now).toISOString(),
    }

    console.error(`[ConfiguratorDiagnostics] Emergency UI shutdown: ${this._renderGuard.value.reason}; route=${routePath}; component=${componentName}; hits=${hits}; error=${error.message}; info=${errorInfo}`)

    return this._renderGuard.value
  }

  /** Сбрасывает накопленные ошибки и активный render guard. */
  public reset(): void {
    this._recentErrorTimestamps.length = 0
    this._renderGuard.value = null
  }

  /** Запускает контролируемый recursive-update сценарий для diagnostics UI. */
  public triggerTest(params: { routePath?: string, componentName?: string } = {}): ConfiguratorRenderGuardState | null {
    return this.capture({
      err: new Error('Maximum recursive updates exceeded [guard-test]'),
      errorInfo: 'https://vuejs.org/error-reference/#runtime-15',
      componentName: params.componentName ?? 'GuardTest',
      routePath: params.routePath ?? '',
      isEndgeIDE: true,
    })
  }

  /**
   * ----------------------------------------
   * PRIVATE
   * ----------------------------------------
   */

  /** Очищает persistent state IDE перед аварийным отключением. */
  private _clearEndgeIDEPersistedState(): void {
    this._storage.clearEndgeIDEState()
  }

  /** Обновляет error window и возвращает число актуальных попаданий. */
  private _recordRecentError(now: number): number {
    while (
      this._recentErrorTimestamps.length > 0
      && now - this._recentErrorTimestamps[0]! > this._config.errorWindowMs
    ) {
      this._recentErrorTimestamps.shift()
    }
    this._recentErrorTimestamps.push(now)
    return this._recentErrorTimestamps.length
  }

  /** Нормализует произвольное thrown value в Error. */
  private _normalizeError(err: unknown): Error {
    if (err instanceof Error) {
      return err
    }
    if (typeof err === 'string') {
      return new Error(err)
    }

    try {
      return new Error(JSON.stringify(err))
    }
    catch {
      return new Error(String(err))
    }
  }

  /** Распознаёт recursive Vue update по message и stack. */
  private _looksLikeRecursiveVueUpdate(error: Error): boolean {
    const message = `${error.message}\n${error.stack ?? ''}`.toLowerCase()

    return message.includes('maximum recursive updates')
  }

  /**
   * ----------------------------------------
   * ACCESS
   * ----------------------------------------
   */

  /** Возвращает readonly reactive render guard. */
  public get renderGuard(): Readonly<ShallowRef<ConfiguratorRenderGuardState | null>> {
    return this._renderGuard
  }
}
