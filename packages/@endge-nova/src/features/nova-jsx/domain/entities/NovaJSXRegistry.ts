import type { NovaJSXRenderer } from '@/features/nova-jsx/domain/types'

export class NovaJSXRegistry {
  private readonly _renderers = new Map<string, NovaJSXRenderer>()

  register(tag: string, renderer: NovaJSXRenderer): void {
    this._renderers.set(tag, renderer)
  }

  get(tag: string): NovaJSXRenderer | undefined {
    return this._renderers.get(tag)
  }

  has(tag: string): boolean {
    return this._renderers.has(tag)
  }
}
