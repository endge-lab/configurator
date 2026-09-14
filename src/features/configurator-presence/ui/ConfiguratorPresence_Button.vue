<script setup lang="ts">
import { UsersRound } from 'lucide-vue-next'
import { onErrorCaptured } from 'vue'
import { useI18n } from 'vue-i18n'

import { Configurator } from '@/app/Configurator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const { t } = useI18n()
const { connections, count } = Configurator.presence

onErrorCaptured(() => {
  Configurator.presence.hideUnavailable()
  return false
})
</script>

<template>
  <DropdownMenu v-if="count">
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        class="relative ml-2 inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-md border border-transparent bg-transparent px-1.5 text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :aria-label="t('configuratorPresence.button', { count })"
        :title="t('configuratorPresence.button', { count })"
      >
        <UsersRound class="size-4 shrink-0" aria-hidden="true" />
        <span class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] leading-none font-medium text-primary tabular-nums" aria-hidden="true">{{ count }}</span>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" :side-offset="6" class="w-72">
      <DropdownMenuLabel class="text-xs text-muted-foreground">
        {{ t('configuratorPresence.title') }}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <ul class="max-h-72 overflow-y-auto p-1" :aria-label="t('configuratorPresence.title')">
        <li v-for="connection in connections" :key="`${connection.serverUrl}/${connection.instanceId}`" class="flex items-center gap-2.5 rounded-sm px-1.5 py-2">
          <Avatar class="size-8 shrink-0">
            <AvatarFallback class="bg-muted text-xs text-muted-foreground">
              {{ connection.initials || '?' }}
            </AvatarFallback>
          </Avatar>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm" :title="connection.displayName">
              {{ connection.displayName || t('configuratorPresence.unknownUser') }}
            </div>
            <div class="truncate text-xs text-muted-foreground">
              {{ connection.isOwnAccount ? t('configuratorPresence.ownAccount') : t('configuratorPresence.connection') }}
              <span class="font-mono">{{ t('configuratorPresence.connectionId', { id: connection.instanceId.slice(0, 8) }) }}</span>
            </div>
          </div>
        </li>
      </ul>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
