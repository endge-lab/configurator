import type { EndgeDataMode } from '@endge/core'

const STORAGE_KEY_PREFIX = 'endge-ide:data-mode-override:v2'

/** Хранилище переопределения runtime-режима данных уровня Workspace только для Configurator. */
export class ConfiguratorDataModeRepository {
  public read(backendURL: string, workspaceIdentity: string): EndgeDataMode | null {
    if (typeof window === 'undefined') {
      return null
    }

    try {
      const value = window.localStorage.getItem(this.storageKey(backendURL, workspaceIdentity))
      return value === 'mock' || value === 'live' ? value : null
    }
    catch {
      return null
    }
  }

  public write(backendURL: string, workspaceIdentity: string, mode: EndgeDataMode): void {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(this.storageKey(backendURL, workspaceIdentity), mode)
    }
    catch {
      // Configurator сохраняет работоспособность, когда browser storage недоступен.
    }
  }

  public clear(backendURL: string, workspaceIdentity: string): void {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.removeItem(this.storageKey(backendURL, workspaceIdentity))
    }
    catch {
      // Configurator сохраняет работоспособность, когда browser storage недоступен.
    }
  }

  public storageKey(backendURL: string, workspaceIdentity: string): string {
    const backend = String(backendURL ?? '').trim() || 'detached'
    const identity = String(workspaceIdentity ?? '').trim() || 'detached'
    return `${STORAGE_KEY_PREFIX}:${encodeURIComponent(backend)}:${encodeURIComponent(identity)}`
  }
}

export const configuratorDataModeRepository = new ConfiguratorDataModeRepository()
