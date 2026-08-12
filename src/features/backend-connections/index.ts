export type {
  BackendConnection,
  BackendConnectionCatalog,
  BackendConnectionCatalogState,
} from '@/features/backend-connections/domain/types/backend-connection.type'
export {
  ACTIVE_BACKEND_STORAGE_KEY,
  ACTIVE_WORKSPACE_STORAGE_KEY_PREFIX,
  BackendConnectionStorage,
  currentActiveBackendURL,
  currentTargetStorageNamespace,
  normalizeBackendURL,
  workspaceStorageKey,
} from '@/features/backend-connections/model/backend-connection-storage'
export { BackendConnections_Module } from '@/features/backend-connections/model/BackendConnections_Module'
export { BackendConnections_Service } from '@/features/backend-connections/model/BackendConnections_Service'
export { resolveConfiguratorWorkspace } from '@/features/backend-connections/model/resolve-configurator-workspace'
export { useBackendConnections } from '@/features/backend-connections/ui/use-backend-connections'
