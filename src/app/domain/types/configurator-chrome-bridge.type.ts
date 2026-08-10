export type ConfiguratorChromeBridgeRequestType = 'ENDGE_BRIDGE_PING' | 'ENDGE_BRIDGE_EXPORT_DOMAIN'

export interface ConfiguratorChromeBridgeRequest {
  source: 'endge-chrome-extension'
  requestId: string
  type: ConfiguratorChromeBridgeRequestType
}

export interface ConfiguratorChromeBridgeResponse {
  source: 'endge-admin-bridge'
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
