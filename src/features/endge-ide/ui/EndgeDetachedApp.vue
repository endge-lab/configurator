<script setup lang="ts">
import { Settings2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { useLayout } from '@/components/layouts/grid'
import Logo from '@/components/layouts/main/Logo.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import BackendConnections_Modal from '@/features/backend-connections/ui/BackendConnections_Modal.vue'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import CreateDocument_Modal from '@/features/endge-ide/ui/modals/CreateDocument_Modal.vue'

const backendConnectionsModal = ref<InstanceType<typeof BackendConnections_Modal> | null>(null)
const createDocumentOpen = computed({
  get: () => EndgeIDE.modals.isCreateDocumentOpen.value,
  set: (value: boolean) => {
    if (!value) {
      EndgeIDE.modals.closeCreateDocument()
    }
  },
})

useLayout({ title: computed(() => 'Endge') })
</script>

<template>
  <Teleport to="[data-target='grid-layout-header-menu']" defer>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          class="rounded-md px-2 py-1 text-xs font-medium hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {{ $t('detachedWorkspace.file') }}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent class="w-56" align="start" side="bottom" :side-offset="4">
        <DropdownMenuItem @click="backendConnectionsModal?.open()">
          <Settings2 class="size-3.5" />
          {{ $t('detachedWorkspace.connections') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </Teleport>

  <main class="flex h-full min-h-0 flex-1 items-center justify-center p-6 text-muted-foreground">
    <div class="flex max-w-md flex-col items-center gap-5 text-center">
      <div class="rounded-lg p-8 text-muted-foreground/80 opacity-30">
        <Logo icon-height="h-24" />
      </div>
      <div class="space-y-2">
        <h1 class="text-base font-medium text-foreground">
          {{ $t('detachedWorkspace.title') }}
        </h1>
        <p class="text-sm">
          {{ $t('detachedWorkspace.description') }}
        </p>
      </div>
    </div>
  </main>

  <CreateDocument_Modal v-if="createDocumentOpen" v-model:open="createDocumentOpen" />
  <BackendConnections_Modal ref="backendConnectionsModal" />
</template>
