import type { EndgePublishedEvent } from '@endge/core'
import { Endge } from '@endge/core'
import { readonly, shallowRef } from 'vue'

/** Владеет ограниченным журналом текущей сессии Configurator независимо от видимости виджета. */
export class ConfiguratorEvents_Module {
  public readonly limit = 300
  private readonly _items = shallowRef<readonly EndgePublishedEvent[]>([])
  public readonly items = readonly(this._items)
  private _unsubscribe: (() => void) | null = null

  /** Подключается до boot, повторно после reset Core; записи сессии сохраняются. */
  public start(): void {
    this.stop()
    this._unsubscribe = Endge.events.onAny((event) => {
      this._items.value = [...this._items.value, event]
        .sort((left, right) => left.sequence - right.sequence)
        .slice(-this.limit)
    })
  }

  public stop(): void {
    this._unsubscribe?.()
    this._unsubscribe = null
  }

  public clear(): void {
    this._items.value = []
  }

  public reset(): void {
    this.stop()
    this.clear()
  }
}
