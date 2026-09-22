<script setup lang="ts">
import type { DocumentMetadataSession } from '@/features/endge-ide/services/document-metadata-session'
import { FileJson2, Settings2 } from 'lucide-vue-next'
import { computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import DocumentMetadataEditor from '@/features/endge-ide/ui/components/DocumentMetadataEditor.vue'
import SettingsNavigationPanel from '@/features/endge-ide/ui/components/settings/SettingsNavigationPanel.vue'
import { useSmartTabSelection, useSmartTabViewState } from '@/features/endge-ide/ui/smart-tabs'

const props = withDefaults(defineProps<{
  session?: DocumentMetadataSession | null
  contentClass?: string
}>(), {
  session: null,
  contentClass: 'p-6',
})
const { t } = useI18n()
const session = computed(() => props.session ?? EndgeIDE.tabs.documentMetadataSession.value)
const activeSection = useSmartTabSelection('document.general-settings-section', 'general', ['general', 'metadata'] as const)
const sidebarWidth = useSmartTabViewState<number>('document.general-settings-width', {
  defaultValue: () => 224,
  validate: value => typeof value === 'number' && Number.isFinite(value) && value >= 192 && value <= 420,
})
const sections = computed(() => [
  { id: 'general' as const, label: t('documentMetadata.general'), icon: Settings2 },
  { id: 'metadata' as const, label: t('documentMetadata.metadata'), icon: FileJson2 },
])

watchEffect(() => session.value?.refreshFromDocument())

function updateMetadataDraft(value: string): void {
  session.value?.updateDraft(value)
}

function updateMetadataValidation(error: string | null): void {
  if (session.value) {
    session.value.error = error
  }
}

function commitMetadata(): void {
  session.value?.prepareBeforeSave()
}
</script>

<template>
  <SettingsNavigationPanel
    v-if="session"
    v-model="activeSection"
    v-model:sidebar-width="sidebarWidth"
    :default-sidebar-width="224"
    :separator-label="t('documentMetadata.resizeNavigation')"
    class="h-full rounded-none border-0 shadow-none"
  >
    <template #navigation>
      <TabsList class="flex h-auto w-full flex-col items-stretch justify-start gap-1 rounded-none bg-transparent p-2">
        <TabsTrigger
          v-for="section in sections"
          :key="section.id"
          :value="section.id"
          class="group h-9 w-full justify-start gap-2 rounded-md border-0 border-l-2 border-l-transparent px-2.5 text-left text-sm font-medium shadow-none data-[state=active]:border-l-primary data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
        >
          <component :is="section.icon" class="size-3.5 shrink-0 text-muted-foreground group-data-[state=active]:text-primary" />
          <span>{{ section.label }}</span>
        </TabsTrigger>
      </TabsList>
    </template>

    <div v-show="activeSection === 'general'" class="min-h-0 flex-1 overflow-auto" :class="contentClass">
      <slot />
    </div>
    <DocumentMetadataEditor
      v-if="activeSection === 'metadata'"
      :model-value="session.draft"
      :read-only="session.readOnly || !session.projection.editable"
      :message="session.projection.message"
      :external-error="session.error"
      @update:model-value="updateMetadataDraft"
      @validation="updateMetadataValidation"
      @commit="commitMetadata"
    />
  </SettingsNavigationPanel>
  <div v-else class="min-h-0 flex-1 overflow-auto" :class="contentClass">
    <slot />
  </div>
</template>
