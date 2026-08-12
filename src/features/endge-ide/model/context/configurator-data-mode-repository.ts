import type { EndgeDataMode } from '@endge/core'

const STORAGE_KEY_PREFIX = 'endge-ide:data-mode-override:v2'

/** Configurator-only persistence for a Workspace-scoped runtime data mode override. */
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
      // Configurator remains usable when browser storage is unavailable.
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
      // Configurator remains usable when browser storage is unavailable.
    }
  }

  public storageKey(backendURL: string, workspaceIdentity: string): string {
    const backend = String(backendURL ?? '').trim() || 'detached'
    const identity = String(workspaceIdentity ?? '').trim() || 'detached'
    return `${STORAGE_KEY_PREFIX}:${encodeURIComponent(backend)}:${encodeURIComponent(identity)}`
  }
}

export const configuratorDataModeRepository = new ConfiguratorDataModeRepository()
