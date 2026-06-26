<script lang="ts" setup>
import type { RouteRecordRaw } from 'vue-router'

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem as BreadcrumbItemComponent,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSidebar } from '@/components/ui/sidebar'

export interface BreadcrumbItem {
  title: string
  href?: string | RouteRecordRaw
}

interface Props {
  items: BreadcrumbItem[]
  itemsToDisplay?: number
}

const props = withDefaults(defineProps<Props>(), {
  itemsToDisplay: 3,
})

const isOpen = ref(false)
const { isMobile } = useSidebar()
const { t } = useI18n()

const firstLabel = computed(() => props.items[0]?.title)

const effectiveItemsToDisplay = computed(() => {
  return isMobile.value ? 1 : props.itemsToDisplay
})

const allButLastTwoItems = computed(() => {
  if (effectiveItemsToDisplay.value === 1) {
    return props.items.slice(0, -1) // All items except the last one
  }
  if (props.items.length <= effectiveItemsToDisplay.value)
    return []
  return props.items.slice(1, -(effectiveItemsToDisplay.value - 1))
})

const remainingItems = computed(() => {
  if (effectiveItemsToDisplay.value === 1) {
    return props.items.slice(-1) // Show only the last item when itemsToDisplay is 1
  }
  if (props.items.length <= effectiveItemsToDisplay.value) {
    return props.items.slice(1) // All items except the first one
  }
  return props.items.slice(-(effectiveItemsToDisplay.value - 1))
})
</script>

<template>
  <Breadcrumb>
    <BreadcrumbList>
      <BreadcrumbItemComponent v-if="props.items[0] && effectiveItemsToDisplay > 1">
        <template v-if="props.items[0].href">
          <BreadcrumbLink as-child>
            <RouterLink :to="props.items[0].href">
              {{ firstLabel }}
            </RouterLink>
          </BreadcrumbLink>
        </template>
        <BreadcrumbPage v-else>
          {{ firstLabel }}
        </BreadcrumbPage>
      </BreadcrumbItemComponent>
      <BreadcrumbSeparator v-if="props.items.length > 1 && effectiveItemsToDisplay > 1" />
      <template v-if="props.items.length > effectiveItemsToDisplay">
        <BreadcrumbItemComponent>
          <DropdownMenu v-if="!isMobile" v-model:open="isOpen">
            <DropdownMenuTrigger
              class="flex items-center gap-1"
              :aria-label="t('nav.breadcrumbs.toggleMenu')"
            >
              <BreadcrumbEllipsis class="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem v-for="item of allButLastTwoItems" :key="item.title">
                <template v-if="item.href">
                  <RouterLink :to="item.href" class="w-full">
                    {{ item.title }}
                  </RouterLink>
                </template>
                <span v-else class="w-full">
                  {{ item.title }}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Drawer v-else v-model:open="isOpen">
            <DrawerTrigger :aria-label="t('nav.breadcrumbs.toggleMenu')">
              <BreadcrumbEllipsis class="h-4 w-4" />
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader class="text-left">
                <DrawerTitle>{{ t('nav.breadcrumbs.navigateTo') }}</DrawerTitle>
                <DrawerDescription>
                  {{ t('nav.breadcrumbs.selectPage') }}
                </DrawerDescription>
              </DrawerHeader>
              <div class="grid gap-1 px-4">
                <template v-for="item of allButLastTwoItems" :key="item.title">
                  <RouterLink
                    v-if="item.href"
                    :to="item.href"
                    class="py-1 text-sm"
                  >
                    {{ item.title }}
                  </RouterLink>
                  <span v-else class="py-1 text-sm">
                    {{ item.title }}
                  </span>
                </template>
              </div>
              <DrawerFooter class="pt-4">
                <DrawerClose as-child>
                  <Button variant="outline">
                    {{ t('nav.breadcrumbs.close') }}
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </BreadcrumbItemComponent>
        <BreadcrumbSeparator />
      </template>
      <template v-for="(item, index) of remainingItems" :key="item.title">
        <BreadcrumbItemComponent>
          <template v-if="item.href && index < remainingItems.length - 1">
            <BreadcrumbLink
              as-child
              class="max-w-20 truncate md:max-w-48"
            >
              <RouterLink :to="item.href">
                {{ item.title }}
              </RouterLink>
            </BreadcrumbLink>
          </template>
          <BreadcrumbPage v-else class="max-w-24 truncate md:max-w-48">
            {{ item.title }}
          </BreadcrumbPage>
        </BreadcrumbItemComponent>
        <BreadcrumbSeparator v-if="index < remainingItems.length - 1" />
      </template>
    </BreadcrumbList>
  </Breadcrumb>
</template>
