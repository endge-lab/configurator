import type { EndgeBackendConfig } from '@/features/endge-ide/domain/types/endge-backend.type'
import type { EndgeDomainProvider, EndgeExecutionContext } from '@endge/core'

export interface ConfiguratorContextSurfaceLifecycle {
  beforeContextReset?: () => Promise<void> | void
  afterContextBoot?: () => Promise<void> | void
}

export interface ConfiguratorContextInitOptions {
  context?: Partial<EndgeExecutionContext>
  backendConfig?: EndgeBackendConfig
  domainProvider?: EndgeDomainProvider
  workspaceRole?: 'viewer' | 'editor' | 'admin'
}
