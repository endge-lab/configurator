<script setup lang="ts">
import { ArrowUpRight, ChevronsUpDown } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { appSwitcherGroups, useAppSwitcherIcon } from './apps'

defineProps<{
  contentClass?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
}>()

const { resolveIcon } = useAppSwitcherIcon()
const { t } = useI18n()

function isNewTab(href: string): boolean {
  return href !== '/'
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <slot>
        <Button variant="ghost" size="sm" class="gap-2 px-2 hover:bg-muted-foreground/10 dark:hover:bg-muted-foreground/20 hover:text-card-foreground">
          <span class="font-medium">{{ appSwitcherGroups[0]?.links[0]?.title ?? t('app.title') }}</span>
          <ChevronsUpDown class="size-4 text-muted-foreground" />
        </Button>
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      :class="contentClass ?? 'w-64 rounded-lg'"
      :align="align ?? 'start'"
      :side="side"
      :side-offset="sideOffset ?? 4"
    >
      <template v-for="(group, groupIndex) in appSwitcherGroups" :key="groupIndex">
        <DropdownMenuSeparator v-if="groupIndex > 0" />
        <DropdownMenuLabel class="text-xs text-muted-foreground">
          {{ group.label }}
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem
            v-for="link in group.links"
            :key="link.href"
            as="a"
            :href="link.href"
            :target="isNewTab(link.href) ? '_blank' : undefined"
            :rel="isNewTab(link.href) ? 'noopener noreferrer' : undefined"
            class="gap-3 cursor-pointer"
          >
            <template v-if="resolveIcon(link.icon)">
              <img v-if="resolveIcon(link.icon)!.type === 'url'" :src="(resolveIcon(link.icon) as any).src" class="size-4 shrink-0">
              <component :is="(resolveIcon(link.icon) as any).component" v-else class="size-4 shrink-0" />
            </template>
            <div class="flex flex-col gap-0.5 flex-1 min-w-0">
              <span class="truncate text-sm">{{ link.title }}</span>
              <span v-if="link.description" class="truncate text-xs text-muted-foreground">{{ link.description }}</span>
            </div>
            <ArrowUpRight v-if="link.isExternal" class="size-3.5 shrink-0 text-muted-foreground" />
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </template>
      <template v-if="appSwitcherGroups.length === 0">
        <DropdownMenuLabel class="text-xs text-muted-foreground">
          {{ t('nav.apps.title') }}
        </DropdownMenuLabel>
        <DropdownMenuItem disabled class="text-xs text-muted-foreground">
          {{ t('nav.apps.empty') }}
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
