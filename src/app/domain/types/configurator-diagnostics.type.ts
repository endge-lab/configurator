export interface ConfiguratorRenderFailure {
  err: unknown
  errorInfo?: string
  componentName?: string
  routePath?: string
  isEndgeIDE?: boolean
}

export interface ConfiguratorRenderGuardState {
  error: Error
  errorInfo: string
  componentName: string
  routePath: string
  reason: 'recursive-updates' | 'error-storm'
  hits: number
  triggeredAt: string
}

export interface ConfiguratorDiagnosticsConfig {
  errorWindowMs: number
  errorStormLimit: number
}

export interface ConfiguratorDiagnosticsState {
  readonly renderGuard: Readonly<{ value: ConfiguratorRenderGuardState | null }>
}
