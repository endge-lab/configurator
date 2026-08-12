import { currentTargetStorageNamespace } from '@/features/backend-connections/model/backend-connection-storage'

export function createEndgeIDETabsConfig() {
  return {
    storageKey: `endge-editor-tabs:v2:${currentTargetStorageNamespace()}`,
    persist: true,
    maxTabs: 40,
  }
}
