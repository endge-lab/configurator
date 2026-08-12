<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import { Building2, ChevronRight, ServerOff } from 'lucide-vue-next'
import { computed } from 'vue'

import { Configurator } from '@/app'

const workspaces = computed(() => Configurator.workspaceSelection)

function selectWorkspace(identity: string): void {
  Configurator.connections.selectWorkspace(identity)
}
</script>

<template>
  <main class="fixed inset-0 z-[300] grid place-items-center bg-slate-950 px-5 py-10 text-slate-100">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.13),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.1),transparent_38%)]" />
    <section class="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl shadow-black/50 backdrop-blur">
      <header class="border-b border-white/10 px-7 py-6">
        <p class="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-orange-300">
          {{ Configurator.connections.activeBackendURL }}
        </p>
        <h1 class="text-2xl font-semibold tracking-tight">
          Выберите рабочее пространство
        </h1>
        <p class="mt-2 text-sm leading-6 text-slate-400">
          Выбор сохранится только для этого backend. Configurator продолжит запуск после полной перезагрузки.
        </p>
      </header>

      <div v-if="workspaces.length" class="max-h-[52vh] space-y-2 overflow-y-auto p-4">
        <button
          v-for="workspace in workspaces"
          :key="workspace.id"
          type="button"
          class="group flex w-full items-center gap-4 rounded-xl border border-white/8 bg-white/[0.035] px-4 py-3.5 text-left transition hover:border-orange-400/40 hover:bg-orange-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          @click="selectWorkspace(workspace.identity)"
        >
          <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-800 text-orange-300 group-hover:bg-orange-400/15">
            <Building2 class="size-5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-slate-100">{{ workspace.displayName }}</span>
            <span class="mt-0.5 block truncate font-mono text-xs text-slate-500">{{ workspace.identity }} · {{ workspace.role }}</span>
          </span>
          <ChevronRight class="size-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-orange-300" />
        </button>
      </div>

      <div v-else class="flex flex-col items-center px-8 py-14 text-center">
        <span class="mb-4 grid size-12 place-items-center rounded-full bg-red-500/10 text-red-300">
          <ServerOff class="size-6" />
        </span>
        <h2 class="font-medium">
          Нет доступных рабочих пространств
        </h2>
        <p class="mt-2 max-w-md text-sm leading-6 text-slate-400">
          У текущей учётной записи нет доступа ни к одному активному Workspace на выбранном backend.
        </p>
      </div>
    </section>
  </main>
</template>
