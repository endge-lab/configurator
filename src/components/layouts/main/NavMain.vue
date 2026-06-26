<script setup lang="ts">
import type { NavItemGroup } from '@/components/layouts/main/navigation.ts'

import { ArrowUpRight, ChevronRight, X } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import Logo from '@/components/layouts/main/Logo.vue'
import { isGroupActiveByRoute, isItemGroup, isItemLink, useNavigation } from '@/components/layouts/main/navigation.ts'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

const { state, setOpenMobile } = useSidebar()
const route = useRoute()
const navigation = useNavigation()

// (опционально) оставил как было - если ещё используется где-то
const openGroups = ref<Set<number>>(new Set())

// Открытая "папка" (только одна)
const openGroupKey = ref<number | null>(null)

function getGroupKey(groupIndex: number, itemIndex: number): number {
  return groupIndex * 1000 + itemIndex
}

function isGroupOpen(groupIndex: number, itemIndex: number): boolean {
  return openGroupKey.value === getGroupKey(groupIndex, itemIndex)
}

function toggleGroup(groupIndex: number, itemIndex: number): void {
  const key = getGroupKey(groupIndex, itemIndex)
  openGroupKey.value = openGroupKey.value === key ? null : key
}

function isGroupActive(item: NavItemGroup): boolean {
  return isGroupActiveByRoute(item, route)
}

// Initialize open groups based on current route
function updateOpenGroups(): void {
  navigation.value.forEach((group, groupIndex) => {
    group.items.forEach((item, itemIndex) => {
      if (isItemGroup(item) && isGroupActive(item)) {
        openGroups.value.add(getGroupKey(groupIndex, itemIndex))
      }
    })
  })
}

function closeSidebar(): void {
  // на десктопе может не закрывать - но на мобиле точно
  try {
    setOpenMobile?.(false)
  }
  catch {}
}

function linkClick() {
  openGroupKey.value = null
  closeSidebar()
}

watch(() => route.path, () => {
  updateOpenGroups()
})

watch(navigation, () => {
  updateOpenGroups()
}, { deep: true })
</script>

<template>
  <!-- Header -->
  <div class="flex items-center gap-2 p-3">
    <Logo icon-height="h-8" />

    <!-- крестик справа -->
    <button
      type="button"
      class="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-black hover:bg-transparent focus:outline-none"
      aria-label="Close"
      @click="closeSidebar"
    >
      <X class="h-5 w-5" />
    </button>
  </div>

  <template v-for="(group, index) in navigation" :key="index">
    <SidebarGroup v-if="!group.hidden" class="px-10">
      <SidebarGroupLabel
        v-if="group.title"
        class="truncate"
        :class="{ 'group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:-mt-2 group-data-[collapsible=icon]:text-[0.5rem] group-data-[collapsible=icon]:text-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mb-0.5 group-data-[collapsible=icon]:leading-tight': !!group.collapsedTitle }"
      >
        {{ state === 'expanded' ? group.title : group.collapsedTitle }}
      </SidebarGroupLabel>

      <SidebarMenu>
        <template v-for="(item, itemIndex) in group.items" :key="itemIndex">
          <!-- LINK -->
          <SidebarMenuItem v-if="isItemLink(item) && !item.hidden" class="relative w-full">
            <template v-if="item.asGroupButton">
              <a
                v-if="item.external"
                :href="item.disabled ? undefined : (item.link as string)"
                target="_blank"
                rel="noopener noreferrer"
                class="
                  w-full
                  rounded-lg
                  py-2 px-5
                  text-sm
                  uppercase
                  flex gap-1 items-center justify-center
                  hover:bg-sky-100 hover:text-sky-700
                  data-[active=true]:bg-sky-100 data-[active=true]:text-sky-700
                "
                :class="item.disabled ? 'opacity-50 pointer-events-none' : ''"
                :aria-disabled="item.disabled ? 'true' : 'false'"
                :tabindex="item.disabled ? -1 : 0"
                @click.stop="item.disabled ? $event.preventDefault() : linkClick()"
              >
                {{ item.title }}
                <ChevronRight class="w-5 opacity-80" />
              </a>

              <RouterLink
                v-else
                :to="item.disabled ? route.fullPath : item.link"
                class="
                  w-full
                  rounded-lg
                  py-2 px-5
                  text-sm
                  uppercase
                  flex gap-1 items-center justify-center
                  hover:bg-sky-100 hover:text-sky-700
                  data-[active=true]:bg-sky-100 data-[active=true]:text-sky-700
                "
                :class="item.disabled ? 'opacity-50 pointer-events-none' : ''"
                :aria-disabled="item.disabled ? 'true' : 'false'"
                :tabindex="item.disabled ? -1 : 0"
                @click.stop="item.disabled ? $event.preventDefault() : linkClick()"
              >
                {{ item.title }}
                <ChevronRight class="w-5 opacity-80" />
              </RouterLink>
            </template>

            <SidebarMenuButton
              v-else
              as-child
              :tooltip="item.title"
              class="
      cursor-pointer
      hover:bg-sky-100 hover:text-sky-700
      data-[active=true]:bg-sky-100 data-[active=true]:text-sky-700
      data-[disabled=true]:opacity-50 data-[disabled=true]:pointer-events-none
    "
              :data-disabled="item.disabled ? 'true' : 'false'"
            >
              <a
                v-if="item.external"
                :href="item.disabled ? undefined : (item.link as string)"
                :aria-disabled="item.disabled ? 'true' : 'false'"
                :tabindex="item.disabled ? -1 : 0"
                @click="item.disabled ? $event.preventDefault() : linkClick()"
              >
                <Component :is="item.icon" />
                <span class="truncate">{{ item.title }}</span>
                <ArrowUpRight class="ml-auto shrink-0 opacity-50" />
              </a>

              <RouterLink
                v-else
                :to="item.disabled ? route.fullPath : item.link"
                :aria-disabled="item.disabled ? 'true' : 'false'"
                :tabindex="item.disabled ? -1 : 0"
                active-class="bg-sky-100 text-sky-700"
                @click="item.disabled ? $event.preventDefault() : linkClick()"
              >
                <Component :is="item.icon" />
                <span class="truncate">{{ item.title }}</span>
              </RouterLink>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <!-- GROUP (popover по клику) -->
          <SidebarMenuItem
            v-else-if="isItemGroup(item) && !item.hidden"
            class="relative w-full"
          >
            <Popover
              :open="isGroupOpen(index, itemIndex)"
              @update:open="(v) => openGroupKey = v ? getGroupKey(index, itemIndex) : null"
            >
              <PopoverTrigger as-child class="w-full">
                <div class="w-full" @click.prevent.stop="item.disabled ? undefined : toggleGroup(index, itemIndex)">
                  <button
                    class="
                      w-full
                      rounded-lg
                      py-2 px-5
                      text-sm
                      uppercase
                      flex gap-1 items-center justify-center
                      hover:bg-sky-100 hover:text-sky-700
                      data-[active=true]:bg-sky-100 data-[active=true]:text-sky-700
                    "
                    :class="item.disabled ? 'opacity-50 pointer-events-none' : ''"
                    :aria-disabled="item.disabled ? 'true' : 'false'"
                    :tabindex="item.disabled ? -1 : 0"
                    :data-active="isGroupActive(item)"
                  >
                    {{ item.title }}
                    <ChevronRight class="w-5 opacity-80" />
                  </button>
                </div>
              </PopoverTrigger>

              <PopoverContent
                side="right"
                :side-offset="8"
                class="min-w-56 rounded-lg bg-background p-0"
              >
                <template v-for="(subItem, subIndex) in item.links.filter(i => !i.hidden)" :key="subIndex">
                  <!-- элементы: чуть сероватый hover, НЕ подсвечиваем active -->
                  <a
                    v-if="subItem.external"
                    :href="subItem.disabled ? undefined : (subItem.link as string)"
                    target="_blank"
                    class="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100"
                    :class="subItem.disabled ? 'opacity-50 pointer-events-none' : ''"
                    :aria-disabled="subItem.disabled ? 'true' : 'false'"
                    :tabindex="subItem.disabled ? -1 : 0"
                    @click.stop="subItem.disabled ? $event.preventDefault() : linkClick()"
                  >
                    <span class="truncate">{{ subItem.title }}</span>
                    <ArrowUpRight class="ml-auto shrink-0 opacity-50" />
                  </a>

                  <RouterLink
                    v-else
                    :to="subItem.disabled ? route.fullPath : subItem.link"
                    class="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                    :class="subItem.disabled ? 'opacity-50 pointer-events-none' : ''"
                    :aria-disabled="subItem.disabled ? 'true' : 'false'"
                    :tabindex="subItem.disabled ? -1 : 0"
                    @click.stop="subItem.disabled ? $event.preventDefault() : linkClick()"
                  >
                    <span class="truncate">{{ subItem.title }}</span>
                  </RouterLink>
                </template>
              </PopoverContent>
            </Popover>
          </SidebarMenuItem>
        </template>
      </SidebarMenu>
    </SidebarGroup>
  </template>
</template>
