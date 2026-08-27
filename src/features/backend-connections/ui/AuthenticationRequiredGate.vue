<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import { ArrowLeft, LogIn, ShieldAlert } from 'lucide-vue-next'

import { Configurator } from '@/app/model/kernel/configurator'

const requirement = Configurator.authenticationRequirement
const canSwitchToPrimary = !Configurator.connections.isPrimaryActive

function retryAuthentication(): void {
  Configurator.retryAuthentication()
}

function switchToPrimary(): void {
  Configurator.connections.fallbackToPrimary()
}
</script>

<template>
  <main class="fixed inset-0 z-[300] grid place-items-center bg-background px-5 py-10 text-foreground">
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="authentication-required-title"
      class="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xl"
    >
      <header class="flex items-center gap-4 border-b border-border bg-muted/25 px-7 py-6">
        <span class="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <ShieldAlert class="size-5" />
        </span>
        <h1 id="authentication-required-title" class="text-2xl font-semibold tracking-tight">
          Требуется авторизация
        </h1>
      </header>

      <div class="px-7 py-6">
        <p class="break-all font-mono text-sm text-muted-foreground">
          {{ requirement?.backendURL ?? Configurator.connections.activeBackendURL }}
        </p>
      </div>

      <footer class="flex justify-end gap-2 border-t border-border bg-muted/20 px-7 py-5">
        <button
          v-if="canSwitchToPrimary"
          type="button"
          class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          @click="switchToPrimary"
        >
          <ArrowLeft class="size-4" />
          Перейти на основной
        </button>
        <button
          type="button"
          class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          @click="retryAuthentication"
        >
          <LogIn class="size-4" />
          Войти снова
        </button>
      </footer>
    </section>
  </main>
</template>
