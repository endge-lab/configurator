<script setup lang="ts">
import {
  LogOut,
  UserRoundXIcon,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/shared/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

const props = defineProps<{
  user?: {
    name: string
    username: string
    avatar?: string
  }
  contentClass?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
  logoutPending?: boolean
}>()

const emit = defineEmits<{
  logout: []
}>()

const { t } = useI18n()

const avatarFallback = computed(() => {
  return props.user?.name.split(' ').map(word => word.charAt(0).toUpperCase()).slice(0, 2).join('')
})

const version = `v${import.meta.env.VITE_VERSION} (${import.meta.env.VITE_GIT_SHA})`
const env = import.meta.env.MODE
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <slot>
        <button class="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent transition-colors">
          <template v-if="user">
            <Avatar class="h-7 w-7">
              <AvatarImage v-if="user.avatar" :src="user.avatar" :alt="user.name" />
              <AvatarFallback class="text-xs">
                {{ avatarFallback }}
              </AvatarFallback>
            </Avatar>
            <span class="text-sm font-medium hidden sm:inline">{{ user.name }}</span>
          </template>
          <template v-else>
            <Avatar class="h-7 w-7">
              <AvatarFallback>
                <UserRoundXIcon class="size-4" />
              </AvatarFallback>
            </Avatar>
            <span class="text-sm font-medium hidden sm:inline">{{ t('nav.user.guest') }}</span>
          </template>
        </button>
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      :class="contentClass ?? 'w-56 rounded-lg'"
      :align="align ?? 'end'"
      :side="side"
      :side-offset="sideOffset ?? 4"
    >
      <DropdownMenuLabel class="p-0 font-normal">
        <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
          <template v-if="user">
            <Avatar class="h-8 w-8 rounded-lg">
              <AvatarImage v-if="user.avatar" :src="user.avatar" :alt="user.name" />
              <AvatarFallback class="rounded-lg">
                {{ avatarFallback }}
              </AvatarFallback>
            </Avatar>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">{{ user.name }}</span>
              <span class="truncate text-xs">{{ user.username }}</span>
            </div>
          </template>
          <template v-else>
            <Avatar class="h-8 w-8 rounded-lg">
              <AvatarFallback class="rounded-lg">
                <UserRoundXIcon class="size-4" />
              </AvatarFallback>
            </Avatar>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">{{ t('nav.user.guest') }}</span>
            </div>
          </template>
        </div>
      </DropdownMenuLabel>
      <template v-if="user">
        <DropdownMenuSeparator />
        <DropdownMenuItem :disabled="logoutPending" @click="emit('logout')">
          <LogOut />
          {{ logoutPending ? t('nav.user.loggingOut') : t('nav.user.logout') }}
        </DropdownMenuItem>
      </template>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled class="text-xs flex-col items-start gap-0">
        <p>{{ version }}</p>
        <p>{{ env }}</p>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
