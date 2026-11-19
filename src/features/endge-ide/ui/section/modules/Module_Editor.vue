<script setup lang="ts">
import type { CatalogModuleDetail } from '@/features/endge-ide/adapters/backend/ServiceBackendModulesHttp_Adapter'
import { Loader2, Pencil, Plus } from 'lucide-vue-next'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { useConfiguratorSession } from '@/features/configurator-session/ui/configurator-session-context'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import ModuleFormDialog from './ModuleFormDialog.vue'
import ModuleVersionDialog from './ModuleVersionDialog.vue'

const props = defineProps<{ identity: string }>()
const { t } = useI18n()
const { state: sessionState } = useConfiguratorSession()
const canPublish = computed(() => sessionState.value.status === 'authenticated' && sessionState.value.session.platformAdmin)
const catalog = EndgeIDE.moduleCatalog
const entry = shallowRef<CatalogModuleDetail>()
const error = ref('')
const retry = ref(0)
const form = ref<'edit' | 'publish'>()

watch([() => props.identity, retry], async ([identity], _previous, onCleanup) => {
  const request = new AbortController()
  onCleanup(() => request.abort())
  entry.value = undefined
  form.value = undefined
  error.value = ''
  try {
    const detail = await catalog.transport.detail(identity, request.signal)
    if (!request.signal.aborted) {
      entry.value = detail
    }
  }
  catch (cause) {
    if (!request.signal.aborted) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    }
  }
}, { immediate: true })

function onSaved(detail: CatalogModuleDetail): void {
  entry.value = detail
  form.value = undefined
  EndgeIDE.tabs.openCatalogModule(detail, false)
}
</script>

<template>
  <SourceDocumentEditorShell>
    <template #right>
      <div v-if="canPublish && entry" class="flex gap-1">
        <Button size="sm" variant="ghost" @click="form = 'edit'">
          <Pencil /> {{ t('moduleCatalog.edit') }}
        </Button>
        <Button size="sm" variant="outline" @click="form = 'publish'">
          <Plus /> {{ t('moduleCatalog.addVersion') }}
        </Button>
      </div>
    </template>

    <div class="size-full overflow-auto bg-muted/25 p-4">
      <div v-if="error" class="flex items-center gap-3" role="alert">
        <p class="text-sm text-destructive">
          {{ error }}
        </p>
        <Button size="sm" variant="outline" @click="retry++">
          {{ t('moduleCatalog.retry') }}
        </Button>
      </div>
      <p v-else-if="!entry" class="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 class="size-4 animate-spin" /> {{ t('moduleCatalog.loading') }}
      </p>
      <section v-else class="max-w-3xl space-y-4">
        <div class="space-y-1">
          <h1 class="text-lg font-medium">
            {{ entry.name }}
          </h1>
          <code class="break-all text-sm text-muted-foreground">{{ entry.identity }}</code>
          <p v-if="entry.description" class="whitespace-pre-wrap break-words text-sm">
            {{ entry.description }}
          </p>
        </div>
        <section class="space-y-2">
          <h2 class="text-sm font-medium">
            {{ t('moduleCatalog.versions') }}
          </h2>
          <div v-for="version in entry.versions" :key="version.version" class="flex items-center justify-between gap-2 rounded border px-3 py-2">
            <code class="break-all text-sm">{{ version.version }}</code>
            <ModuleVersionDialog :manifest="version.manifest" :archive-url="catalog.transport.archiveURL(version.manifest)" />
          </div>
        </section>
      </section>
    </div>

    <ModuleFormDialog v-if="canPublish && entry && form" :mode="form" :entry="entry" @saved="onSaved" @close="form = undefined" />
  </SourceDocumentEditorShell>
</template>
