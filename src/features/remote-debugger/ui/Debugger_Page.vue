<script setup lang="ts">
import { ChevronsUpDown, Monitor, Unplug } from 'lucide-vue-next'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Configurator } from '@/app/Configurator'
import { Grid } from '@/components/layouts/grid'
import Logo from '@/components/layouts/main/Logo.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import EndgeIDEStatusBar from '@/features/endge-ide/ui/shell/EndgeIDEStatusBar.vue'
import EditorView from '@/features/endge-ide/ui/views/Editor_View.vue'
import BundleImportDialog from './BundleImport_Dialog.vue'

const { t } = useI18n()
const debuggerSession = Configurator.remoteDebugger
const { clients, selected, status, canControl, source, fileName, connected }
  = debuggerSession
const importOpen = ref(false)
function fileDrag(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}
function dragOver(event: DragEvent): void {
  if (fileDrag(event)) {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy'
    }
  }
}
async function dropFile(event: DragEvent): Promise<void> {
  if (!fileDrag(event)) {
    return
  }
  event.preventDefault()
  event.stopImmediatePropagation()
  const files = Array.from(event.dataTransfer?.files ?? [])
  importOpen.value = true
  if (await debuggerSession.openFiles(files)) {
    importOpen.value = false
  }
}
onMounted(() => {
  window.addEventListener('dragover', dragOver, true)
  window.addEventListener('drop', dropFile, true)
})
function close(): void {
  Configurator.closeDebugger()
}
onBeforeUnmount(() => {
  window.removeEventListener('dragover', dragOver, true)
  window.removeEventListener('drop', dropFile, true)
  debuggerSession.dispose()
})
</script>

<template>
  <Grid>
    <template #header>
      <Logo icon-height="h-8" />
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="flex max-w-md items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            :aria-label="t('remoteDebugger.selectLabel')"
          >
            <Monitor class="size-4 shrink-0" />
            <span class="truncate">{{
              (source === "file" ? fileName : selected?.label)
                || t("remoteDebugger.selectApplication")
            }}</span>
            <ChevronsUpDown class="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="min-w-72">
          <DropdownMenuItem @select="importOpen = true">
            {{ t('bundleInspection.loadMenu') }}
          </DropdownMenuItem>
          <DropdownMenuItem
            v-for="client in clients"
            :key="`${client.serverUrl}:${client.instanceId}`"
            @select="debuggerSession.select(client)"
          >
            <div class="flex flex-col gap-0.5">
              <span>{{ client.label || t("remoteDebugger.application") }}</span>
              <span class="text-xs text-muted-foreground">{{
                client.workspaceDisplayName || client.workspaceIdentity || client.instanceId
              }}</span>
            </div>
          </DropdownMenuItem>
          <p
            v-if="clients.length === 0"
            class="px-2 py-3 text-xs text-muted-foreground"
          >
            {{ t("remoteDebugger.noApplications") }}
          </p>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip v-if="source === 'remote'">
        <TooltipTrigger as-child>
          <span class="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground" role="status" tabindex="0">
            <span class="size-2 rounded-full" :class="connected ? 'bg-green-500' : 'bg-red-500'" aria-hidden="true" />
            {{ connected ? t('remoteDebugger.online') : t('remoteDebugger.offline') }}
          </span>
        </TooltipTrigger>
        <TooltipContent>{{ connected ? t('remoteDebugger.onlineHint') : t('remoteDebugger.offlineHint') }}</TooltipContent>
      </Tooltip>
      <button
        type="button"
        class="ml-auto flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
        @click="close"
      >
        <Unplug class="size-4" /> {{ t("remoteDebugger.endSession") }}
      </button>
    </template>
    <div class="flex min-h-0 flex-1 flex-col">
      <div
        v-if="status"
        class="shrink-0 border-b px-3 py-1 text-xs text-muted-foreground"
        role="status"
      >
        {{ status }}
      </div>
      <EditorView class="min-h-0 flex-1" />
    </div>
    <template #status-bar>
      <EndgeIDEStatusBar :readonly="!canControl" />
    </template>
  </Grid>
  <BundleImportDialog v-model:open="importOpen" />
</template>
