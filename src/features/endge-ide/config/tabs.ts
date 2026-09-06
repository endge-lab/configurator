import { currentTargetStorageNamespace } from '@/features/backend-connections/services/backend-connection-storage'

export function createEndgeIDETabsConfig() {
  return {
    storageKey: 'configurator.smart-tabs',
    legacyStorageKeys: [`endge-editor-tabs:v2:${currentTargetStorageNamespace()}`],
    maxTabs: 40,
  }
}
