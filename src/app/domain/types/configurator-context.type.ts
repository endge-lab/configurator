import type { EndgeBootMode, EndgeDomainProvider, EndgeExecutionContext } from '@endge/core'
import type { EndgeBackendConfig } from '@/features/endge-ide/domain/types/endge-backend.type'

export interface ConfiguratorContextSurfaceLifecycle {
  beforeContextReset?: () => Promise<void> | void
  afterContextBoot?: () => Promise<void> | void
  afterDataModeChange?: () => Promise<void> | void
}

export interface ConfiguratorContextInitOptions {
  mode?: EndgeBootMode
  context?: Partial<EndgeExecutionContext>
  backendConfig?: EndgeBackendConfig
  domainProvider?: EndgeDomainProvider
  workspaceRole?: 'viewer' | 'editor' | 'admin'
  workspaceIdentity?: string
  userIdentity?: string
}
