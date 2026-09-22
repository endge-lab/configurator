<script setup lang="ts">
import { ChevronRight, Plus, Server } from 'lucide-vue-next'
import { ref } from 'vue'

import { Configurator } from '@/app/Configurator'
import { Button } from '@/components/ui/button'
import BackendConnections_Modal from '@/features/backend-connections/ui/BackendConnections_Modal.vue'
import { useBackendConnections } from '@/features/backend-connections/ui/use-backend-connections'

const { catalog } = useBackendConnections()
const selecting = ref(false)
const connectionsModal = ref<InstanceType<typeof BackendConnections_Modal> | null>(null)

function selectBackend(backendURL: string): void {
  if (selecting.value) {
    return
  }
  selecting.value = true
  Configurator.connections.switchBackend(backendURL)
}
</script>

<template>
  <main class="fixed inset-0 z-[300] grid place-items-center bg-background px-5 py-10 text-foreground">
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="backend-selection-title"
      aria-describedby="backend-selection-description"
      class="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xl"
    >
      <header class="border-b border-border bg-muted/25 px-7 py-6">
        <h1 id="backend-selection-title" class="text-2xl font-semibold tracking-tight">
          {{ $t('backendSelection.title') }}
        </h1>
        <p id="backend-selection-description" class="mt-2 text-sm text-muted-foreground">
          {{ $t('backendSelection.description') }}
        </p>
      </header>
      <div class="max-h-[60vh] space-y-2 overflow-y-auto p-4">
        <button
          v-for="(connection, index) in catalog.localItems"
          :key="`${connection.source}:${connection.id}`"
          type="button"
          :autofocus="index === 0"
          :disabled="selecting"
          class="group flex w-full items-center gap-4 rounded-lg border border-border px-4 py-3.5 text-left transition hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          @click="selectBackend(connection.baseUrl)"
        >
          <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Server class="size-5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">{{ connection.name }}</span>
            <span class="mt-1 block break-all text-xs text-muted-foreground">{{ connection.baseUrl }}</span>
          </span>
          <ChevronRight class="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
        </button>
        <p v-if="catalog.localItems.length === 0" class="px-4 py-8 text-center text-sm text-muted-foreground">
          {{ $t('backendConnections.emptyLocal') }}
        </p>
      </div>
      <footer class="flex justify-end border-t border-border bg-muted/20 px-7 py-5">
        <Button class="gap-2" @click="connectionsModal?.open()">
          <Plus class="size-4" />
          {{ $t('backendConnections.addLocal') }}
        </Button>
      </footer>
    </section>
    <BackendConnections_Modal ref="connectionsModal" />
  </main>
</template>
