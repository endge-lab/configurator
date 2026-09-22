import type { SimulationMockStream } from '@endge/core'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ServiceBackendMockGenerator_Adapter } from '@/features/endge-ide/adapters/backend/ServiceBackendMockGenerator_Adapter'

const options: SimulationMockStream = { kind: 'mock-stream', type: 'Quote', event: 'quote.updated', seed: 'demo', intervalMs: 1000, itemsPerMessage: 5, fields: {} }
const callbacks = () => ({ open: vi.fn(), message: vi.fn(), error: vi.fn() })
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })

describe('mock generator transport lifecycle', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('deletes a session when stop precedes the create response, without subscribing', async () => {
    let complete!: (response: Response) => void
    const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => {
      complete = resolve
    })).mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    const events = callbacks()
    const connection = new ServiceBackendMockGenerator_Adapter('https://backend.test', 'workspace-a').openStream({}, options, events)
    const closing = connection.close()
    complete(json({ id: 'session-1' }, 201))
    await closing
    await connection.close()
    expect(fetch.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ['https://backend.test/api/v1/mock-data/streams', 'POST'],
      ['https://backend.test/api/v1/mock-data/streams/session-1', 'DELETE'],
    ])
    expect(events.open).not.toHaveBeenCalled()
    expect(events.message).not.toHaveBeenCalled()
  })

  it('keeps one SSE subscription while paused, renews its lease, and forwards business roots', async () => {
    vi.useFakeTimers()
    let stream!: ReadableStreamDefaultController<Uint8Array>
    const body = new ReadableStream<Uint8Array>({ start(controller) {
      stream = controller
    } })
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/events')) {
        return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
      }
      if (url.endsWith('/streams')) {
        return json({ id: 'session-2' }, 201)
      }
      return new Response(null, { status: 204 })
    })
    vi.stubGlobal('fetch', fetch)
    const events = callbacks()
    const connection = new ServiceBackendMockGenerator_Adapter('https://backend.test', 'workspace-a').openStream({}, options, events)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    const emit = (value: unknown) => stream.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(value)}\r\n\r\n`))
    emit({ type: 'started' })
    await vi.waitFor(() => expect(events.open).toHaveBeenCalledOnce())
    emit({ type: 'data', sequence: 1, items: [{ symbol: 'BTC/USD', lastPrice: 10 }] })
    await vi.waitFor(() => expect(events.message).toHaveBeenCalledOnce())
    expect(events.message.mock.calls[0]?.[0].data).toEqual({ symbol: 'BTC/USD', lastPrice: 10 })
    await connection.pause?.()
    emit({ type: 'data', sequence: 2, items: [{ symbol: 'BTC/USD', lastPrice: 20 }] })
    await vi.advanceTimersByTimeAsync(30000)
    expect(events.message).toHaveBeenCalledOnce()
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/keepalive'))).toBe(true)
    await connection.resume?.()
    emit({ type: 'data', sequence: 3, items: [{ symbol: 'BTC/USD', lastPrice: 30 }] })
    await vi.waitFor(() => expect(events.message).toHaveBeenCalledTimes(2))
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/events'))).toHaveLength(1)
    for (const call of fetch.mock.calls) {
      const init = (call as unknown as [string, RequestInit])[1]
      expect(init.credentials).toBe('include')
      expect(init.headers).toMatchObject({ 'X-Endge-Workspace': 'workspace-a' })
    }
    await connection.close()
    stream.close()
    await vi.advanceTimersByTimeAsync(30000)
    expect(events.error).not.toHaveBeenCalled()
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/keepalive'))).toHaveLength(1)
  })

  it('reports generator failures without opening the business transport', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ code: 'mock_unavailable', message: 'Unavailable' }, 503))
    vi.stubGlobal('fetch', fetch)
    const events = callbacks()
    const connection = new ServiceBackendMockGenerator_Adapter('https://backend.test', 'workspace-a').openStream({}, options, events)
    await vi.waitFor(() => expect(events.error).toHaveBeenCalledOnce())
    expect(events.open).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledOnce()
    await connection.close()
  })
})
