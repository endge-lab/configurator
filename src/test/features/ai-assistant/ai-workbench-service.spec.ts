import { afterEach, describe, expect, it, vi } from 'vitest'

import { AIWorkbench_HTTP_Adapter } from '@/features/ai-assistant/adapters/AIWorkbench_HTTP_Adapter'

describe('aIWorkbench_Service', () => {
  afterEach(() => vi.restoreAllMocks())

  it('scopes every request to the selected workspace', async () => {
    const request = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      available: true,
      canView: true,
      canRun: false,
      reason: 'models_not_configured',
      adapters: ['anthropic', 'ollama'],
      models: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const service = new AIWorkbench_HTTP_Adapter('http://backend.local/', 'workspace-a')

    await expect(service.capabilities()).resolves.toMatchObject({ available: true, models: [] })
    expect(request).toHaveBeenCalledWith('http://backend.local/api/v1/ai/capabilities', expect.objectContaining({
      credentials: 'include',
      headers: expect.objectContaining({ 'X-Endge-Workspace': 'workspace-a' }),
    }))
  })

  it('parses a hardcoded SSE stream incrementally', async () => {
    const frames = [
      'event: started\ndata: {"type":"started","runId":"run-1","createdAt":"2026-08-26T00:00:00Z"}\n\n',
      'event: content_delta\ndata: {"type":"content_delta","delta":"hardcoded","createdAt":"2026-08-26T00:00:01Z"}\n\n',
      'event: completed\ndata: {"type":"completed","messageId":"message-1","createdAt":"2026-08-26T00:00:02Z"}\n\n',
    ]
    const stream = new ReadableStream({
      start(controller) {
        for (const frame of frames) {
          controller.enqueue(new TextEncoder().encode(frame))
        }
        controller.close()
      },
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }))
    const events: string[] = []
    const service = new AIWorkbench_HTTP_Adapter('http://backend.local', 'workspace-a')

    await service.run('conversation-1', { requestId: crypto.randomUUID(), modelProfileId: crypto.randomUUID(), prompt: 'hello' }, event => events.push(event.type), new AbortController().signal)
    expect(events).toEqual(['started', 'content_delta', 'completed'])
  })

  it('uses physical DELETE for catalog resources', async () => {
    const request = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    const service = new AIWorkbench_HTTP_Adapter('http://backend.local', 'workspace-a')

    await service.deleteConnection('connection-1')
    await service.deleteModel('model-1')

    expect(request.mock.calls.map(([, init]) => init?.method)).toEqual(['DELETE', 'DELETE'])
  })
})
