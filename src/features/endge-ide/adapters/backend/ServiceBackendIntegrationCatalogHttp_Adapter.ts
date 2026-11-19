interface IntegrationMetadata {
  id: string
  identity: string
  version: string
  active: boolean
}

export class ServiceBackendIntegrationCatalogHttpAdapter {
  public constructor(private readonly _baseURL: string) {}

  public async list(signal: AbortSignal): Promise<IntegrationMetadata[]> {
    const response = await fetch(`${this._baseURL.replace(/\/$/, '')}/api/v1/integrations`, {
      credentials: 'include',
      cache: 'no-store',
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    })
    if (!response.ok) {
      throw new Error(`Integration catalog is unavailable (${response.status}).`)
    }
    const payload = await response.json() as { items: IntegrationMetadata[] }
    return payload.items
  }
}
