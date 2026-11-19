import type { ModuleArtifactLoader, ModuleManifest, ModuleReference } from '@endge/core'
import type { VueModuleExports, VueModuleHost } from '@endge/ui-vue'
import { createVueModuleArtifact } from '@endge/ui-vue'

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

interface CatalogVersionDescriptor extends CatalogModuleVersion {
  archiveUrl: string
  assets: { js: string, css?: string }
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

  public loader(host: () => Promise<VueModuleHost>): ModuleArtifactLoader {
    return async (reference, signal) => {
      const descriptor = await this._json<CatalogVersionDescriptor>(this._version(reference), { signal })
      const manifest = descriptor.manifest
      if (manifest.identity !== reference.identity || manifest.version !== reference.version
        || manifest.formatVersion !== 1 || manifest.hostApi !== 1) {
        throw new Error(`Incompatible module manifest for "${reference.identity}@${reference.version}".`)
      }
      const js = this._assetURL(descriptor.assets.js, reference, 'module.js')
      const cssURL = descriptor.assets.css && this._assetURL(descriptor.assets.css, reference, 'module.css')
      const [dependencies, css] = await Promise.all([
        host(),
        cssURL ? this._request(cssURL, { signal }).then(response => response.text()) : undefined,
      ])
      signal.throwIfAborted()
      const module = await import(/* @vite-ignore */ js) as VueModuleExports
      signal.throwIfAborted()
      return createVueModuleArtifact(module, dependencies, css)
    }
  }

  private _assetURL(path: string, reference: ModuleReference, filename: string): string {
    const expected = new URL(this._url(`${this._version(reference)}/assets/${filename}`))
    const resolve = new URL(path, expected.origin)
    if (resolve.origin !== location.origin || resolve.origin !== expected.origin
      || decodeURIComponent(resolve.pathname) !== decodeURIComponent(expected.pathname) || resolve.search || resolve.hash) {
      throw new Error(`The module asset must use the Configurator origin and catalog path: ${filename}.`)
    }
    return resolve.href
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
