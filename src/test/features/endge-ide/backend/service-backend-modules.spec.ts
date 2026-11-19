import type { VueModuleHost } from '@endge/ui-vue'
import { createVueModuleCatalogLoader } from '@endge/ui-vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ServiceBackendModulesHttpAdapter } from '@/features/endge-ide/adapters/backend/ServiceBackendModulesHttp_Adapter'

const base = 'http://localhost:4298/endge-backend'
const catalog = `${base}/api/v1/modules`

afterEach(() => vi.unstubAllGlobals())

describe('global module catalog transport', () => {
  it('uses the user session for an unscoped multipart upload and a revision-aware patch', async () => {
    const request = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ id: 'm1' })))
    vi.stubGlobal('fetch', request)
    const adapter = new ServiceBackendModulesHttpAdapter(base)
    const file = new File(['archive'], 'test.zip')
    await adapter.create({ identity: 'example', name: 'Example', description: 'Description' }, file)
    await adapter.publish('example', file)
    await adapter.patch({ identity: 'example', name: 'Renamed', description: '', revision: 4 })

    const upload = request.mock.calls[0]?.[1] as RequestInit
    expect(request.mock.calls[0]?.[0]).toBe(catalog)
    expect(upload).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(upload.headers).toBeUndefined()
    expect((upload.body as FormData).get('identity')).toBe('example')
    expect((upload.body as FormData).get('archive')).toBe(file)
    expect(request.mock.calls[1]?.[0]).toBe(`${catalog}/example/versions`)
    expect(request.mock.calls[2]).toEqual([`${catalog}/example`, expect.objectContaining({
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'If-Match': '"4"' },
    })])
  })

  it('rejects another version or origin before importing the JavaScript', async () => {
    const reference = { identity: 'example', version: '1.0.0' }
    const manifest = { ...reference, formatVersion: 1, hostApi: 1 }
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json({ version: '1.0.0', manifest: { ...manifest, version: '2.0.0' } }))
      .mockResolvedValueOnce(Response.json({ version: '1.0.0', manifest, assets: { js: 'https://other.test/module.js' } }))
    vi.stubGlobal('location', new URL(base))
    vi.stubGlobal('fetch', request)
    const host = vi.fn<() => Promise<VueModuleHost>>()
    const loader = createVueModuleCatalogLoader({ backendURL: base, host })
    const signal = new AbortController().signal
    await expect(loader(reference, signal)).rejects.toThrow('Incompatible module manifest')
    await expect(loader(reference, signal)).rejects.toThrow('use the configured Backend origin')
    expect(host).not.toHaveBeenCalled()
    expect(request.mock.calls[0]).toEqual([`${catalog}/example/versions/1.0.0`, expect.objectContaining({ credentials: 'same-origin', signal })])
  })
})
