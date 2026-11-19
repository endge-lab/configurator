import type { ModuleManifest, ModuleReference } from '@endge/core'

export interface CatalogModule {
  id: string
  identity: string
  name: string
  description: string
  revision: number
}

export interface CatalogModuleVersion {
  version: string
  manifest: ModuleManifest
  sha256: string
  size: number
  hasCss: boolean
  publishedBy: string
  publishedAt: string
}

export interface CatalogModuleDetail extends CatalogModule {
  versions: CatalogModuleVersion[]
}

export class ServiceBackendModulesHttpAdapter {
  public constructor(private readonly _baseURL: string) {}

  public async list(signal?: AbortSignal): Promise<CatalogModule[]> {
    const result = await this._json<{ items: CatalogModule[] }>('', { signal })
    return result.items
  }

  public detail(identity: string, signal?: AbortSignal): Promise<CatalogModuleDetail> {
    return this._json(this._identity(identity), { signal })
  }

  public create(value: Pick<CatalogModule, 'identity' | 'name' | 'description'>, archive: File): Promise<CatalogModuleDetail> {
    const body = new FormData()
    body.set('identity', value.identity)
    body.set('name', value.name)
    body.set('description', value.description)
    body.set('archive', archive)
    return this._json('', { method: 'POST', body })
  }

  public patch(value: Pick<CatalogModule, 'identity' | 'revision' | 'name' | 'description'>): Promise<CatalogModule> {
    return this._json(this._identity(value.identity), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': `"${value.revision}"` },
      body: JSON.stringify({ name: value.name, description: value.description }),
    })
  }

  public publish(identity: string, archive: File): Promise<CatalogModuleVersion> {
    const body = new FormData()
    body.set('archive', archive)
    return this._json(`${this._identity(identity)}/versions`, { method: 'POST', body })
  }

  public archiveURL(reference: ModuleReference): string {
    return this._url(`${this._version(reference)}/archive`)
  }

  private _identity(identity: string): string {
    return `/${encodeURIComponent(identity)}`
  }

  private _version(reference: ModuleReference): string {
    return `${this._identity(reference.identity)}/versions/${encodeURIComponent(reference.version)}`
  }

  private _url(path: string): string {
    return `${this._baseURL.replace(/\/$/, '')}/api/v1/modules${path}`
  }

  private async _json<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this._request(this._url(path), init)
    return response.json() as Promise<T>
  }

  private async _request(url: string, init: RequestInit): Promise<Response> {
    const response = await fetch(url, { ...init, credentials: 'include', cache: 'no-store' })
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.error?.message ?? error?.message ?? `Module catalog request failed (${response.status}).`)
    }
    return response
  }
}
