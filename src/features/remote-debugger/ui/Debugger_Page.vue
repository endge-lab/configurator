<script setup lang="ts">
import { ChevronsUpDown, Monitor, Unplug } from 'lucide-vue-next'
import { onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { Configurator } from '@/app/Configurator'
import { Grid } from '@/components/layouts/grid'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import EndgeIDEStatusBar from '@/features/endge-ide/ui/shell/EndgeIDEStatusBar.vue'
import EditorView from '@/features/endge-ide/ui/views/Editor_View.vue'

const { t } = useI18n()
const debuggerSession = Configurator.remoteDebugger
const { clients, selected, status, context } = debuggerSession
function close(): void {
  Configurator.closeDebugger()
}
onBeforeUnmount(() => {
  debuggerSession.dispose()
})
</script>

<template>
  <Grid>
    <template #header>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button type="button" class="flex max-w-md items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent" :aria-label="t('remoteDebugger.selectLabel')">
            <Monitor class="size-4 shrink-0" />
            <span class="truncate">{{ selected?.label || t('remoteDebugger.selectApplication') }}</span>
            <ChevronsUpDown class="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="min-w-72">
          <DropdownMenuItem v-for="client in clients" :key="`${client.serverUrl}:${client.instanceId}`" @select="debuggerSession.select(client)">
            <div class="flex flex-col gap-0.5">
              <span>{{ client.label || t('remoteDebugger.application') }}</span>
              <span class="text-xs text-muted-foreground">{{ client.instanceId }}</span>
            </div>
          </DropdownMenuItem>
          <p v-if="clients.length === 0" class="px-2 py-3 text-xs text-muted-foreground">
            {{ t('remoteDebugger.noApplications') }}
          </p>
        </DropdownMenuContent>
      </DropdownMenu>
      <button type="button" class="ml-auto flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent" @click="close">
        <Unplug class="size-4" /> {{ t('remoteDebugger.endSession') }}
      </button>
    </template>
    <div class="flex min-h-0 flex-1 flex-col">
      <div class="shrink-0 border-b px-3 py-1 text-xs text-muted-foreground" role="status">
        {{ status }}
      </div>
      <EditorView class="min-h-0 flex-1" />
    </div>
    <template #status-bar>
      <EndgeIDEStatusBar :context-snapshot="context" />
    </template>
  </Grid>
</template>
