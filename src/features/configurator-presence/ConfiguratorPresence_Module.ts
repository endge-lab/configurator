import type { ConfiguratorPresenceConnection } from '@/features/configurator-presence/domain/types/configurator-presence.type'

import { Endge } from '@endge/core'
import { computed, readonly, shallowRef } from 'vue'

/** Проецирует список Bridge для хедера, не создавая собственный транспорт. */
export class ConfiguratorPresence_Module {
  /** Производное состояние и подписка живут только в текущем lifecycle приложения. */
  private readonly _connections = shallowRef<readonly ConfiguratorPresenceConnection[]>([])
  private readonly _status = shallowRef<'idle' | 'connecting' | 'connected' | 'unavailable'>('idle')
  private _unsubscribe: (() => void) | null = null
  private _warned = false
  private _viewFailed = false
  public readonly connections = readonly(this._connections)
  public readonly status = readonly(this._status)
  public readonly count = computed(() => this._connections.value.length)

  /**
   * ----------------------------------------
   * PUBLIC
   * ----------------------------------------
   */

  /** Подписывается один раз; отсутствие Bridge не мешает запуску приложения. */
  public init(): void {
    if (this._unsubscribe) {
      return
    }
    try {
      this._unsubscribe = Endge.bridge.subscribe(() => this._sync())
      this._sync()
    }
    catch {
      this.hideUnavailable()
    }
  }

  /** Изолирует ошибку необязательного UI до следующего lifecycle приложения. */
  public hideUnavailable(): void {
    this._viewFailed = true
    this._connections.value = []
    this._status.value = 'unavailable'
    this._warn()
  }

  /** Снимает подписку и удаляет проекцию при полном сбросе приложения. */
  public reset(): void {
    try {
      this._unsubscribe?.()
    }
    catch {
      this._warn()
    }
    this._unsubscribe = null
    this._connections.value = []
    this._status.value = 'idle'
    this._warned = false
    this._viewFailed = false
  }

  /**
   * ----------------------------------------
   * PRIVATE
   * ----------------------------------------
   */

  /** Принимает только актуальные подключения; ошибочный список не выходит в UI. */
  private _sync(): void {
    if (this._viewFailed) {
      return
    }
    try {
      const states = Endge.bridge.connections
      const connected = states.filter(state => state.status === 'connected' && state.instanceId)
      const roster = Endge.bridge.configurator.connections
      const connections: ConfiguratorPresenceConnection[] = []
      for (const state of connected) {
        const own = roster.find(item => item.serverUrl === state.serverUrl && item.instanceId === state.instanceId)
        if (!own) {
          continue
        }
        for (const item of roster) {
          if (item.serverUrl !== state.serverUrl || item.instanceId === state.instanceId) {
            continue
          }
          if (typeof item.instanceId !== 'string' || !item.instanceId || typeof item.userId !== 'string'
            || typeof item.displayName !== 'string' || typeof item.label !== 'string') {
            throw new TypeError('Invalid configurator presence entry')
          }
          connections.push({
            ...item,
            isOwnAccount: item.userId === own.userId,
            initials: item.displayName.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] ?? '').join('').toUpperCase(),
          })
        }
      }
      this._connections.value = connections.sort((a, b) => a.displayName.localeCompare(b.displayName) || a.instanceId.localeCompare(b.instanceId))
      this._status.value = connected.length ? 'connected' : states.some(state => state.error) ? 'unavailable' : states.length ? 'connecting' : 'idle'
      if (this._status.value === 'unavailable') {
        this._warn()
      }
      else if (this._status.value === 'connected') {
        this._warned = false
      }
    }
    catch {
      this._connections.value = []
      this._status.value = 'unavailable'
      this._warn()
    }
  }

  /** Предупреждает один раз за сбой без payload, персональных данных и toast. */
  private _warn(): void {
    if (!this._warned) {
      this._warned = true
      console.warn('[ConfiguratorPresence] Список подключений временно недоступен. Работа конфигуратора продолжается.')
    }
  }
}
