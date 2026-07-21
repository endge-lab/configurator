import type { EndgeDataMode } from '@endge/core'

const STORAGE_KEY_PREFIX = 'endge-ide:data-mode-override:v1'

/** Configurator-only persistence for a Workspace-scoped runtime data mode override. */
export class ConfiguratorDataModeRepository {
  public read(workspaceIdentity: string): EndgeDataMode | null {
    if (typeof window === 'undefined') {
      return null
    }

    try {
      const value = window.localStorage.getItem(this.storageKey(workspaceIdentity))
      return value === 'mock' || value === 'live' ? value : null
    }
    catch {
      return null
    }
  }

  public write(workspaceIdentity: string, mode: EndgeDataMode): void {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(this.storageKey(workspaceIdentity), mode)
    }
    catch {
      // Configurator remains usable when browser storage is unavailable.
    }
  }

  public clear(workspaceIdentity: string): void {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.removeItem(this.storageKey(workspaceIdentity))
    }
    catch {
      // Configurator remains usable when browser storage is unavailable.
    }
  }

  public storageKey(workspaceIdentity: string): string {
    const identity = String(workspaceIdentity ?? '').trim() || 'detached'
    return `${STORAGE_KEY_PREFIX}:${encodeURIComponent(identity)}`
  }
}

export const configuratorDataModeRepository = new ConfiguratorDataModeRepository()
