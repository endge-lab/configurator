<script setup lang="ts">
import { UserRoundXIcon } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { UserMenuContent } from '@/components/layouts/shared'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'

const props = defineProps<{
  user?: {
    name: string
    username: string
    avatar?: string
  }
}>()

const { t } = useI18n()

const avatarFallback = computed(() => {
  return props.user?.name.split(' ').map(word => word.charAt(0).toUpperCase()).slice(0, 2).join('')
})
</script>

<template>
  <UserMenuContent :user="user" :side-offset="8">
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
