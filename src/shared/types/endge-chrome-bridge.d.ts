export {}

declare global {
  interface Window {
    __ENDGE_ADMIN_BRIDGE__?: {
      platform: 'endge-admin'
      version: string
      ping: () => unknown
      exportDomainBundle: () => unknown
    }
  }
}
