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

  it('passes clarification linkage and parses the terminal clarification event', async () => {
    const frame = 'event: clarification_required\ndata: {"type":"clarification_required","interactionId":"interaction-1","clarification":{"id":"clarification-1","interactionId":"interaction-1","taskId":"task-1","slot":"entity","question":"Choose","candidates":[],"planVersion":2},"createdAt":"2026-08-26T00:00:00Z"}\n\n'
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(frame))
        controller.close()
      },
    })
    const request = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }))
    const service = new AIWorkbench_HTTP_Adapter('http://backend.local', 'workspace-a')
    const events: string[] = []

    await service.run('conversation-1', {
      requestId: crypto.randomUUID(),
      modelProfileId: crypto.randomUUID(),
      prompt: 'Sample',
      interactionId: 'interaction-1',
      replyToClarificationId: 'clarification-1',
      selectedCandidateId: 'candidate-1',
    }, event => events.push(event.type), new AbortController().signal)

    expect(events).toEqual(['clarification_required'])
    const body = JSON.parse(String(request.mock.calls[0]?.[1]?.body))
    expect(body).toMatchObject({ interactionId: 'interaction-1', replyToClarificationId: 'clarification-1', selectedCandidateId: 'candidate-1' })
  })

  it('restores an open clarification from the messages response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      items: [],
      openClarification: { id: 'clarification-1', interactionId: 'interaction-1', taskId: 'task-1', slot: 'entity', question: 'Choose', candidates: [], planVersion: 2 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const service = new AIWorkbench_HTTP_Adapter('http://backend.local', 'workspace-a')

    await expect(service.messages('conversation-1')).resolves.toMatchObject({ openClarification: { id: 'clarification-1' } })
  })

  it('uses physical DELETE for catalog resources', async () => {
    const request = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    const service = new AIWorkbench_HTTP_Adapter('http://backend.local', 'workspace-a')

    await service.deleteConnection('connection-1')
    await service.deleteModel('model-1')

    expect(request.mock.calls.map(([, init]) => init?.method)).toEqual(['DELETE', 'DELETE'])
  })
})
