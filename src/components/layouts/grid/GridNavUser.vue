<script setup lang="ts">
import { UserRoundXIcon } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { UserMenuContent } from '@/components/layouts/shared'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { useConfiguratorSession } from '@/features/configurator-session'

const { t } = useI18n()
const { state, logout } = useConfiguratorSession()
const logoutPending = ref(false)

interface HeaderUser {
  name: string
  username: string
  avatar?: string
}

const user = computed<HeaderUser | undefined>(() => {
  if (state.value.status !== 'authenticated') {
    return undefined
  }
  const developer = state.value.session.developer
  return {
    name: developer.displayName || developer.username || developer.subject,
    username: developer.username || developer.subject,
  }
})

const avatarFallback = computed(() => {
  return user.value?.name.split(' ').map(word => word.charAt(0).toUpperCase()).slice(0, 2).join('')
})

/** Завершает backend-owned session и передаёт redirect существующему auth flow. */
async function handleLogout(): Promise<void> {
  if (logoutPending.value) {
    return
  }
  logoutPending.value = true
  try {
    await logout()
  }
  catch {
    toast.error(t('nav.user.logoutFailed'))
  }
  finally {
    logoutPending.value = false
  }
}
</script>

<template>
  <UserMenuContent
    :user="user"
    :logout-pending="logoutPending"
    :side-offset="8"
    @logout="handleLogout"
  >
    <button class="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted-foreground/10 dark:hover:bg-muted-foreground/20 hover:text-card-foreground transition-colors">
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
  </UserMenuContent>
</template>
