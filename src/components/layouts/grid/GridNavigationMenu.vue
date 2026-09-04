<script setup lang="ts">
import { ArrowUpRight, ChevronDown } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { isItemGroup, isItemLink, navigation } from '@/components/layouts/shared'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

defineProps<{
  title?: string
  contentClass?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
}>()

const { t } = useI18n()
const router = useRouter()

function handleNavigate(link: string | object) {
  if (typeof link === 'string') {
    router.push(link)
  }
  else {
    router.push(link)
  }
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <slot>
        <Button variant="secondary" size="sm" class="gap-1 px-3 bg-muted-foreground/15 hover:bg-muted-foreground/10 text-card-foreground">
          <span>{{ title || t('app.title') }}</span>
          <ChevronDown class="size-4" />
        </Button>
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      :class="contentClass ?? 'w-56 rounded-lg'"
      :align="align ?? 'start'"
      :side="side"
      :side-offset="sideOffset ?? 4"
    >
      <template v-for="(group, groupIndex) in navigation" :key="groupIndex">
        <template v-if="!group.hidden">
          <DropdownMenuLabel v-if="group.title" class="text-xs text-muted-foreground">
            {{ group.title }}
          </DropdownMenuLabel>

          <template v-for="(item, itemIndex) in group.items" :key="itemIndex">
            <template v-if="isItemLink(item) && !item.hidden">
              <DropdownMenuItem
                v-if="item.external"
                as="a"
                :href="item.link as string"
                target="_blank"
                class="gap-2"
              >
                <component :is="item.icon" v-if="item.icon" class="size-4" />
                <span class="truncate">{{ item.title }}</span>
                <ArrowUpRight class="ml-auto size-4 opacity-50" />
              </DropdownMenuItem>
              <DropdownMenuItem
                v-else
                class="gap-2"
                @click="handleNavigate(item.link)"
              >
                <component :is="item.icon" v-if="item.icon" class="size-4" />
                <span class="truncate">{{ item.title }}</span>
              </DropdownMenuItem>
            </template>

            <DropdownMenuSub v-if="isItemGroup(item) && !item.hidden">
              <DropdownMenuSubTrigger class="gap-2">
                <component :is="item.icon" v-if="item.icon" class="size-4" />
                <span class="truncate">{{ item.title }}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <template v-for="(subItem, subIndex) in item.links" :key="subIndex">
                    <template v-if="!subItem.hidden">
                      <DropdownMenuItem
                        v-if="subItem.external"
                        as="a"
                        :href="subItem.link as string"
                        target="_blank"
                        class="gap-2"
                      >
                        <span class="truncate">{{ subItem.title }}</span>
                        <ArrowUpRight class="ml-auto size-4 opacity-50" />
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        v-else
                        class="gap-2"
                        @click="handleNavigate(subItem.link)"
                      >
                        <span class="truncate">{{ subItem.title }}</span>
                      </DropdownMenuItem>
                    </template>
                  </template>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </template>

          <DropdownMenuSeparator v-if="groupIndex < navigation.length - 1" />
        </template>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
