<script setup lang="ts">
import type { RSettings } from '@endge/core'

import { Endge } from '@endge/core'
import { computed } from 'vue'

import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

/** Список профилей настроек из домена (коллекция settings в payload). */
const profiles = computed<RSettings[]>(() => Endge.domain.getSettings())

function openProfile(identity: string): void {
  EndgeIDE.tabs.openSettingsProfile(identity)
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="p-3 border-b">
      <h3 class="text-sm font-semibold text-foreground">Профили настроек</h3>
      <p class="text-xs text-muted-foreground mt-0.5">
        Выберите профиль для редактирования
      </p>
    </div>
    <div class="flex-1 overflow-auto p-2">
      <ul v-if="profiles.length" class="space-y-1">
        <li
          v-for="p in profiles"
          :key="p.identity"
          class="flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors"
          @click="openProfile(p.identity)"
        >
          <i class="ti ti-settings text-muted-foreground shrink-0" />
          <span class="truncate font-medium">{{ p.displayName || p.identity }}</span>
        </li>
      </ul>
      <p v-else class="text-sm text-muted-foreground p-4">
        Нет профилей настроек в домене
      </p>
    </div>
  </div>
</template>
