import { Endge } from '@endge/core'

const REQUEST_SOURCE = 'endge-chrome-extension'
const RESPONSE_SOURCE = 'endge-admin-bridge'
const BRIDGE_VERSION = '1.0.0'

type BridgeRequestType = 'ENDGE_BRIDGE_PING' | 'ENDGE_BRIDGE_EXPORT_DOMAIN'

interface BridgeRequestMessage {
  source: typeof REQUEST_SOURCE
  requestId: string
  type: BridgeRequestType
}

interface BridgeResponseMessage {
  source: typeof RESPONSE_SOURCE
  requestId: string
  ok: boolean
  payload?: unknown
  error?: string
}

export interface EndgeAdminBridgeBundle {
  version: string
  exportedAt: string
  sourceUrl: string
  projectId: string | null
  environment: string | null
  domain: Record<string, unknown>
}

export interface EndgeAdminBridgeApi {
  readonly platform: 'endge-admin'
  readonly version: string
  ping: () => {
    platform: 'endge-admin'
    version: string
    url: string
    title: string
    projectId: string | null
    environment: string | null
  }
  exportDomainBundle: () => EndgeAdminBridgeBundle
}

declare global {
  interface Window {
    __ENDGE_ADMIN_BRIDGE__?: EndgeAdminBridgeApi
  }
}

function buildBundle(): EndgeAdminBridgeBundle {
  return {
    version: BRIDGE_VERSION,
    exportedAt: new Date().toISOString(),
    sourceUrl: window.location.href,
    projectId: Endge.context.getCurrentProject(),
    environment: Endge.context.getCurrentEnvironment(),
    domain: Endge.domain.toPlain(),
  }
}

function buildPingPayload() {
  return {
    platform: 'endge-admin' as const,
    version: BRIDGE_VERSION,
    url: window.location.href,
    title: document.title,
    projectId: Endge.context.getCurrentProject(),
    environment: Endge.context.getCurrentEnvironment(),
  }
}

function createBridgeApi(): EndgeAdminBridgeApi {
  return {
    platform: 'endge-admin',
    version: BRIDGE_VERSION,
    ping: buildPingPayload,
    exportDomainBundle: buildBundle,
  }
}

function postBridgeResponse(message: BridgeResponseMessage): void {
  window.postMessage(message, window.location.origin)
}

function handleBridgeMessage(event: MessageEvent<BridgeRequestMessage>): void {
  if (event.source !== window)
    return

  const data = event.data
  if (!data || data.source !== REQUEST_SOURCE || !data.requestId)
    return

  try {
    if (data.type === 'ENDGE_BRIDGE_PING') {
      postBridgeResponse({
        source: RESPONSE_SOURCE,
        requestId: data.requestId,
        ok: true,
        payload: buildPingPayload(),
      })
      return
    }

    if (data.type === 'ENDGE_BRIDGE_EXPORT_DOMAIN') {
      postBridgeResponse({
        source: RESPONSE_SOURCE,
        requestId: data.requestId,
        ok: true,
        payload: buildBundle(),
      })
      return
    }

    postBridgeResponse({
      source: RESPONSE_SOURCE,
      requestId: data.requestId,
      ok: false,
      error: `Unsupported bridge request: ${data.type}`,
    })
  }
  catch (error) {
    postBridgeResponse({
      source: RESPONSE_SOURCE,
      requestId: data.requestId,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown bridge error',
    })
  }
}

export function installEndgeChromeBridge(): void {
  if (typeof window === 'undefined')
    return

  document.documentElement.dataset.endgeAdminBridge = '1'

  if (!window.__ENDGE_ADMIN_BRIDGE__) {
    window.__ENDGE_ADMIN_BRIDGE__ = createBridgeApi()
  }

  window.removeEventListener('message', handleBridgeMessage as EventListener)
  window.addEventListener('message', handleBridgeMessage as EventListener)
}
