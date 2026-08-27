<script setup lang="ts">
import { Building2, ChevronRight, LogOut, ServerOff } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Configurator } from '@/app/model/kernel/configurator'

const workspaces = computed(() => Configurator.workspaceSelection)
const logoutPending = ref(false)

function selectWorkspace(identity: string): void {
  Configurator.connections.selectWorkspace(identity)
}

async function logout(): Promise<void> {
  if (logoutPending.value) {
    return
  }
  logoutPending.value = true
  try {
    await Configurator.logout()
  }
  catch {
    toast.error('Не удалось завершить сессию')
    logoutPending.value = false
  }
}
</script>

<template>
  <main class="fixed inset-0 z-[300] grid place-items-center bg-slate-950 px-5 py-10 text-slate-100">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.13),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.1),transparent_38%)]" />
    <section class="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl shadow-black/50 backdrop-blur">
      <header class="flex items-center justify-between gap-4 border-b border-white/10 px-7 py-6">
        <h1 class="text-2xl font-semibold tracking-tight">
          {{ $t('uiText.selectASpacec54b96b5') }}
        </h1>
        <button
          type="button"
          class="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:pointer-events-none disabled:opacity-50"
          :disabled="logoutPending"
          @click="logout"
        >
          <LogOut class="size-4" />
          {{ logoutPending ? $t('nav.user.loggingOut') : $t('nav.user.logout') }}
        </button>
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
          </span>
          <ChevronRight class="size-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-orange-300" />
        </button>
      </div>

      <div v-else class="flex flex-col items-center px-8 py-14 text-center">
        <span class="mb-4 grid size-12 place-items-center rounded-full bg-red-500/10 text-red-300">
          <ServerOff class="size-6" />
        </span>
        <h2 class="font-medium">
          {{ $t('uiText.noAvailableSpacesb308ae40') }}
        </h2>
      </div>
    </section>
  </main>
</template>
