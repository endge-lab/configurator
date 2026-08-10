import type { Component } from 'vue'

import { markRaw, shallowRef } from 'vue'

export interface SourceEditorDialogDefinition {
  id: string
  component: Component
}

interface ActiveSourceEditorDialog {
  definition: SourceEditorDialogDefinition
  input: unknown
}

/** Owns source-editor dialog definitions, active request and request settlement. */
export class SourceEditorDialogs_Module {
  public readonly active = shallowRef<ActiveSourceEditorDialog | null>(null)

  private readonly _definitions = new Map<string, SourceEditorDialogDefinition>()
  private readonly _instanceSequences = new Map<string, number>()
  private _settleActive: ((result: unknown | undefined) => void) | null = null

  public register(definition: SourceEditorDialogDefinition): void {
    const existing = this._definitions.get(definition.id)
    if (existing) {
      if (existing.component !== definition.component) {
        throw new Error(`Source editor dialog "${definition.id}" is already registered.`)
      }
      return
    }

    this._definitions.set(definition.id, {
      ...definition,
      component: markRaw(definition.component),
    })
  }

  public open<TInput, TResult>(id: string, input: TInput): Promise<TResult | undefined> {
    const definition = this._definitions.get(id)
    if (!definition) {
      throw new Error(`Source editor dialog "${id}" is not registered.`)
    }

    this.cancel()
    this.active.value = { definition, input }

    return new Promise<TResult | undefined>((resolve) => {
      this._settleActive = resolve as (result: unknown | undefined) => void
    })
  }

  public resolve(result: unknown): void {
    const settle = this._settleActive
    this._settleActive = null
    this.active.value = null
    settle?.(result)
  }

  public cancel(): void {
    const settle = this._settleActive
    this._settleActive = null
    this.active.value = null
    settle?.(undefined)
  }

  public nextInstanceId(namespace: string): number {
    const next = (this._instanceSequences.get(namespace) ?? 0) + 1
    this._instanceSequences.set(namespace, next)
    return next
  }

  public reset(): void {
    this.cancel()
    this._definitions.clear()
    this._instanceSequences.clear()
  }
}
