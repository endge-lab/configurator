import type { SmartTabViewFactory } from '@/components/ui/smart-tabs/types'

const _views = new Map<string, SmartTabViewFactory>()

export function registerSmartTabView(viewId: string, factory: SmartTabViewFactory): void {
  if (!viewId || typeof viewId !== 'string') {
    throw new Error('registerSmartTabView: viewId must be a non-empty string')
  }
  _views.set(viewId, factory)
}

export function unregisterSmartTabView(viewId: string): void {
  _views.delete(viewId)
}

export function getSmartTabView(viewId: string): SmartTabViewFactory | null {
  return _views.get(viewId) ?? null
}

export function clearSmartTabViews(): void {
  _views.clear()
}
