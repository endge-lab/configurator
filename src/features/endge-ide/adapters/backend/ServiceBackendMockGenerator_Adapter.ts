import type { SimulationGenerator, SimulationMockStream, StreamTransportConnection, StreamTransportFactory } from '@endge/core'

/** Transport одной среды/workspace. Сервис владеет generation plan, PRNG и scheduler. */
export class ServiceBackendMockGenerator_Adapter implements SimulationGenerator {
  public constructor(private readonly _baseURL: string, private readonly _workspace: string) {}

  public async generate(schema: Record<string, unknown>, seed: string, signal: AbortSignal): Promise<unknown> {
    const response = await this._request('/generate', { method: 'POST', signal, body: JSON.stringify({ schema, generation: { count: 1, seed } }) })
    const payload = await response.json() as { items: unknown[] }
    if (!Array.isArray(payload.items) || payload.items.length !== 1) {
      throw new Error('[Simulation] Generator не вернул корневой response.')
    }
    return payload.items[0]
  }

  public openStream(schema: Record<string, unknown>, options: SimulationMockStream, callbacks: Parameters<StreamTransportFactory['open']>[1]): StreamTransportConnection {
    let id: string | null = null
    let closed = false
    let paused = false
    let heartbeat: ReturnType<typeof setInterval> | null = null
    let deleting: Promise<void> | null = null
    let control = Promise.resolve()
    const abort = new AbortController()
    const remove = (): Promise<void> => deleting ??= (async () => {
      if (heartbeat) {
        clearInterval(heartbeat)
        heartbeat = null
      }
      abort.abort()
      if (id) {
        await this._request(`/streams/${encodeURIComponent(id)}`, { method: 'DELETE' }, true)
      }
    })()
    let started: () => void = () => {}
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    const fail = (error: unknown) => {
      if (closed) {
        return
      }
      closed = true
      started()
      callbacks.error(error)
      void remove().catch(callbacks.error)
    }
    const creating = (async () => {
      const response = await this._request('/streams', {
        method: 'POST',
        body: JSON.stringify({ schema, generation: { seed: options.seed }, stream: { intervalMs: options.intervalMs, itemsPerMessage: options.itemsPerMessage, emitImmediately: true } }),
      })
      const session = await response.json() as { id: string }
      if (!session.id) {
        throw new Error('[Simulation] Generator не вернул id сессии.')
      }
      id = session.id
      if (closed) {
        await remove()
        started()
        return
      }
      heartbeat = setInterval(() => {
        void this._request(`/streams/${encodeURIComponent(id!)}/keepalive`, { method: 'POST' }).catch(fail)
      }, 30000)
      void this._consume(`/streams/${encodeURIComponent(id)}/events`, abort.signal, (event) => {
        if (closed) {
          return
        }
        if (event.type === 'started') {
          started()
          callbacks.open()
        }
        else if (event.type === 'data') {
          if (!Array.isArray(event.items)) {
            throw new TypeError('[Simulation] Некорректный SSE batch.')
          }
          if (!paused) {
            event.items.forEach((data, index) => callbacks.message({ sourceEvent: 'message', id: `${event.sequence}:${index}`, data }))
          }
        }
        else if (event.type === 'failed') {
          throw new Error(`[Simulation] Generator завершился с ошибкой: ${JSON.stringify(event.error ?? event)}`)
        }
        else if (event.type === 'completed') {
          throw new Error('[Simulation] Generator завершил SSE сессию.')
        }
      }).catch(fail)
    })().catch(fail)
    const setPaused = (value: boolean): Promise<void> => {
      paused = value
      control = control.then(async () => {
        await ready
        if (closed || !id) {
          return
        }
        await this._request(`/streams/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ paused: value }) })
      }).catch((error) => {
        fail(error)
        throw error
      })
      return control
    }
    return {
      pause: () => setPaused(true),
      resume: () => setPaused(false),
      close: async () => {
        closed = true
        started()
        await creating
        await remove()
      },
    }
  }

  private async _request(path: string, init: RequestInit = {}, allowMissing = false): Promise<Response> {
    const response = await fetch(`${this._baseURL.replace(/\/+$/, '')}/api/v1/mock-data${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(15000),
      credentials: 'include',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Endge-Workspace': this._workspace, ...init.headers },
    })
    if (!response.ok && !(allowMissing && response.status === 404)) {
      const error = await response.json().catch(() => null) as { message?: string, code?: string } | null
      throw new Error(`[Simulation] ${error?.code ?? response.status}: ${error?.message ?? response.statusText}`)
    }
    return response
  }

  private async _consume(path: string, signal: AbortSignal, onEvent: (event: Record<string, unknown>) => void): Promise<void> {
    const response = await this._request(path, { signal, headers: { Accept: 'text/event-stream' } })
    if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
      throw new Error('[Simulation] Ожидался SSE response.')
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let data: string[] = []
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) {
          throw new Error('[Simulation] SSE соединение закрыто.')
        }
        buffer += decoder.decode(chunk.value, { stream: true })
        let newline = buffer.indexOf('\n')
        while (newline >= 0) {
          const line = buffer.slice(0, newline).replace(/\r$/, '')
          buffer = buffer.slice(newline + 1)
          newline = buffer.indexOf('\n')
          if (!line) {
            if (data.length) {
              onEvent(JSON.parse(data.join('\n')) as Record<string, unknown>)
              data = []
            }
          }
          else if (line.startsWith('data:')) {
            data.push(line.slice(5).replace(/^ /, ''))
          }
        }
      }
    }
    finally {
      await reader.cancel().catch(() => undefined)
      reader.releaseLock()
    }
  }
}
