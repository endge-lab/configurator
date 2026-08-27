<script setup lang="ts">
import { ArrowLeft, ServerOff } from 'lucide-vue-next'

import { Configurator } from '@/app/model/kernel/configurator'

const failure = Configurator.backendConnectionFailure

function switchToPrimary(): void {
  Configurator.connections.fallbackToPrimary()
}
</script>

<template>
  <main class="fixed inset-0 z-[300] grid place-items-center bg-background px-5 py-10 text-foreground">
    <section
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="backend-connection-failure-title"
      class="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xl"
    >
      <header class="flex items-center gap-4 border-b border-border bg-muted/25 px-7 py-6">
        <span class="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <ServerOff class="size-5" />
        </span>
        <h1 id="backend-connection-failure-title" class="text-2xl font-semibold tracking-tight">
          {{ $t('uiText.failedToConnect6bd21210') }}
        </h1>
      </header>

      <div class="space-y-4 px-7 py-6">
        <p class="break-all font-mono text-sm text-muted-foreground">
          {{ failure?.backendURL ?? Configurator.connections.activeBackendURL }}
        </p>
        <p class="break-words text-sm leading-5 text-destructive">
          {{ failure?.message ?? 'Backend недоступен' }}
        </p>
      </div>

      <footer class="flex justify-end border-t border-border bg-muted/20 px-7 py-5">
        <button
          type="button"
          class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          @click="switchToPrimary"
        >
          <ArrowLeft class="size-4" />
          {{ $t('uiText.goToMain24ba8bde') }}
        </button>
      </footer>
    </section>
  </main>
</template>
