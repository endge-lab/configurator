/* eslint-disable style/max-statements-per-line */
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

const definitions = new Map<string, SourceEditorDialogDefinition>()
const active = shallowRef<ActiveSourceEditorDialog | null>(null)

let settleActive: ((result: unknown | undefined) => void) | null = null

export function registerSourceEditorDialog(definition: SourceEditorDialogDefinition): void {
  const existing = definitions.get(definition.id)
  if (existing) {
    if (existing.component !== definition.component) { throw new Error(`Source editor dialog "${definition.id}" is already registered.`) }
    return
  }

  definitions.set(definition.id, {
    ...definition,
    component: markRaw(definition.component),
  })
}

export function openSourceEditorDialog<TInput, TResult>(id: string, input: TInput): Promise<TResult | undefined> {
  const definition = definitions.get(id)
  if (!definition) { throw new Error(`Source editor dialog "${id}" is not registered.`) }

  if (settleActive) { settleActive(undefined) }

  active.value = { definition, input }

  return new Promise<TResult | undefined>((resolve) => {
    settleActive = resolve as (result: unknown | undefined) => void
  })
}

export function resolveSourceEditorDialog(result: unknown): void {
  const settle = settleActive
  settleActive = null
  active.value = null
  settle?.(result)
}

export function cancelSourceEditorDialog(): void {
  const settle = settleActive
  settleActive = null
  active.value = null
  settle?.(undefined)
}

export const sourceEditorDialogState = {
  active,
}
