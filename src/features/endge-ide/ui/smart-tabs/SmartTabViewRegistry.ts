import type { SmartTabViewFactory } from '@/features/endge-ide/ui/smart-tabs/types'

/** Реестр фабрик представлений, принадлежащий экземпляру одного рабочего пространства SmartTabs. */
export class SmartTabViewRegistry {
  private readonly _views = new Map<string, SmartTabViewFactory>()

  public register(viewId: string, factory: SmartTabViewFactory): void {
    const id = String(viewId ?? '').trim()
    if (!id) {
      throw new Error('[SmartTabViewRegistry] viewId must be a non-empty string')
    }
    this._views.set(id, factory)
  }

  public unregister(viewId: string): void {
    this._views.delete(viewId)
  }

  public get(viewId: string): SmartTabViewFactory | null {
    return this._views.get(viewId) ?? null
  }

  public reset(): void {
    this._views.clear()
  }
}
