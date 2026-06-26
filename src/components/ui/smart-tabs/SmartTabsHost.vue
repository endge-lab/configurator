<script setup lang="ts">
import type { SmartTabRef, SmartTabsApi, SmartTabsOptions } from '@/components/ui/smart-tabs/types'
import type { Component } from 'vue'

import { X } from 'lucide-vue-next'
import { computed, defineAsyncComponent, h, ref, watch } from 'vue'

import { getSmartTabView } from '@/components/ui/smart-tabs/registry'
import { useSmartTabs } from '@/components/ui/smart-tabs/useSmartTabs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const props = defineProps<{
  options: SmartTabsOptions
  api?: SmartTabsApi
  getIconClass?: (tab: SmartTabRef) => string | null
}>()
const dragTabId = ref<string | null>(null)
const dragOverIndex = ref<number | null>(null)
const tabsStripRef = ref<HTMLElement | null>(null)
const contextMenu = ref<{ tabId: string; x: number; y: number } | null>(null)

const tabsApi = props.api ?? useSmartTabs(props.options)
const tabIconComponentCache = new Map<string, Component>()

console.log('[SmartTabsHost] Инициализация', {
  hasApi: !!props.api,
  options: props.options,
  openTabs: tabsApi.openTabs.value,
  activeTabId: tabsApi.activeTabId.value,
})

const tabs = computed<SmartTabRef[]>(() => tabsApi.openTabs.value)
const activeId = computed(() => tabsApi.activeTabId.value)
const activeTab = computed(() => tabsApi.activeTab.value)

const resolved = computed(() => {
  const currentActiveTab = activeTab.value
  const currentActiveId = activeId.value

  console.log('[SmartTabsHost] resolved computed вызван', {
    activeTab: currentActiveTab,
    activeTabId: currentActiveId,
    hasActiveTab: !!currentActiveTab,
  })

  if (!currentActiveTab || !currentActiveId) {
    console.log('[SmartTabsHost] Нет активной вкладки, возвращаем null')
    return null
  }

  const viewId = currentActiveTab.viewId
  const tabId = currentActiveTab.id

  console.log('[SmartTabsHost] Ищем factory для viewId:', viewId, 'tabId:', tabId)

  const factory = getSmartTabView(viewId)
  console.log('[SmartTabsHost] Factory для viewId', {
    viewId,
    hasFactory: !!factory,
    factoryType: typeof factory,
  })

  if (!factory) {
    console.warn('[SmartTabsHost] View не зарегистрирован:', viewId)
    const errorViewId = viewId
    return {
      component: {
        name: 'ErrorView',
        setup() {
          return () => h('div', { class: 'p-4 text-sm text-destructive' }, [
            h('span', 'SmartTabs: view not registered: '),
            h('span', { class: 'font-mono' }, errorViewId),
          ])
        },
      },
      props: {},
    }
  }

  console.log('[SmartTabsHost] Вызываем factory с tab:', currentActiveTab)
  const result = factory(currentActiveTab)
  console.log('[SmartTabsHost] Factory вернул результат', {
    hasComponent: !!result.component,
    componentType: typeof result.component,
    componentName: (result.component as any)?.name || (result.component as any)?.__name,
    props: result.props,
  })

  return result
})

function getTabIconRaw(tab: SmartTabRef): unknown {
  return props.getIconClass?.(tab) ?? tab.meta?.icon
}

function getIconComponent(tab: SmartTabRef): Component | null {
  const iconRaw = getTabIconRaw(tab)
  if (typeof iconRaw !== 'string')
    return null

  const iconName = iconRaw.trim()
  // class-string (tabler/css) оставляем прежним путем через <i :class="...">
  if (!iconName || iconName.includes(' ') || iconName.startsWith('ti-') || iconName.startsWith('ti '))
    return null

  const cached = tabIconComponentCache.get(iconName)
  if (cached)
    return cached

  const component = defineAsyncComponent(() =>
    import('lucide-vue-next').then((mod) => {
      const icon = (mod as unknown as Record<string, Component>)[iconName]
      if (!icon)
        throw new Error(`[SmartTabsHost] Lucide icon "${iconName}" not found`)
      return icon
    }),
  )
  tabIconComponentCache.set(iconName, component)
  return component
}

function getIconComponentClass(tab: SmartTabRef): string {
  const iconClass = tab.meta?.iconClass
  if (typeof iconClass === 'string' && iconClass.trim())
    return iconClass
  return 'size-4'
}

function close(tabId: string): void {
  console.log('[SmartTabsHost] Закрытие вкладки', { tabId })
  tabsApi.closeTab(tabId)
  console.log('[SmartTabsHost] После закрытия', {
    openTabs: tabsApi.openTabs.value,
    activeTabId: tabsApi.activeTabId.value,
  })
}

function handleDragStart(e: DragEvent, tabId: string, index: number): void {
  dragTabId.value = tabId
  dragOverIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', tabId)
  }
  console.log('[SmartTabsHost] Начало перетаскивания', { tabId, index })
}

function handleDragOver(e: DragEvent, index: number): void {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  dragOverIndex.value = index
}

function handleDragLeave(): void {
  dragOverIndex.value = null
}

function handleDrop(e: DragEvent, dropIndex: number): void {
  e.preventDefault()

  if (dragTabId.value === null) {
    dragOverIndex.value = null
    return
  }

  const dragIndex = tabsApi.openTabs.value.findIndex(t => t.id === dragTabId.value)

  if (dragIndex !== -1 && dragIndex !== dropIndex) {
    tabsApi.moveTab(dragIndex, dropIndex)
  }

  dragTabId.value = null
  dragOverIndex.value = null
  console.log('[SmartTabsHost] Перетаскивание завершено', {
    dragIndex,
    dropIndex,
    newOrder: tabsApi.openTabs.value.map(t => t.id),
  })
}

function handleDragEnd(): void {
  dragTabId.value = null
  dragOverIndex.value = null
}

function openContextMenu(e: MouseEvent, tabId: string): void {
  e.preventDefault()
  contextMenu.value = { tabId, x: e.clientX, y: e.clientY }
}

function closeContextMenu(): void {
  contextMenu.value = null
}

function runContextAction(action: 'close' | 'closeOthers' | 'closeAllToLeft' | 'closeAllToRight'): void {
  const tabId = contextMenu.value?.tabId
  if (!tabId) return
  switch (action) {
    case 'close':
      close(tabId)
      break
    case 'closeOthers':
      tabsApi.closeOthers(tabId)
      break
    case 'closeAllToLeft':
      tabsApi.closeAllToLeft(tabId)
      break
    case 'closeAllToRight':
      tabsApi.closeAllToRight(tabId)
      break
  }
  closeContextMenu()
}

function onContextMenuKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape')
    closeContextMenu()
}
watch(contextMenu, (v) => {
  if (v) {
    document.addEventListener('keydown', onContextMenuKeydown)
  } else {
    document.removeEventListener('keydown', onContextMenuKeydown)
  }
}, { flush: 'sync' })
</script>

<template>
  <div class="flex flex-col flex-1 min-w-0 min-h-0 bg-background">
    <Tabs
      :model-value="activeId ?? ''"
      class="flex flex-col flex-1 min-h-0"
      @update:model-value="(val) => tabsApi.activateTab(String(val))"
    >
      <!-- HEADER: полоса вкладок, справа кнопка «ещё» для непоместившихся вкладок -->
      <div v-if="tabs.length > 0" class="border-b bg-muted/40 flex items-stretch min-w-0">
        <div
          ref="tabsStripRef"
          class="flex-1 min-w-0 overflow-x-auto overflow-y-hidden scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <TabsList class="flex w-max bg-transparent p-0 h-auto border-0">
            <TabsTrigger
              v-for="(tab, index) in tabs"
              :key="tab.id"
              :value="tab.id"
              :data-smart-tab-id="tab.id"
              draggable="true"
              class="group relative flex items-center justify-center gap-2 px-3 py-2 rounded-none border-r last:border-r-0 data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-move transition-all shrink-0" :class="[
                dragTabId === tab.id ? 'opacity-50 scale-95' : '',
                dragOverIndex === index && dragTabId !== tab.id ? 'border-l-2 border-l-primary bg-muted/50' : '',
              ]"
              style="min-width: fit-content; max-width: 200px;"
              @dragstart="(e) => handleDragStart(e, tab.id, index)"
              @dragover="(e) => handleDragOver(e, index)"
              @dragleave="handleDragLeave"
              @drop="(e) => handleDrop(e, index)"
              @dragend="handleDragEnd"
              @contextmenu="(e) => openContextMenu(e, tab.id)"
            >
              <component
                :is="getIconComponent(tab)"
                v-if="getIconComponent(tab)"
                :class="[getIconComponentClass(tab), 'shrink-0']"
              />
              <i
                v-else-if="getIconClass?.(tab) ?? tab.meta?.icon"
                :class="getIconClass?.(tab) ?? tab.meta?.icon"
                class="shrink-0"
              />

              <span class="truncate text-sm text-center">
                {{ tab.label }}
              </span>

              <button
                class="opacity-0 group-hover:opacity-100 transition shrink-0"
                @click.stop="close(tab.id)"
              >
                <X class="size-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      <!-- Контекстное меню вкладки -->
      <Teleport to="body">
        <template v-if="contextMenu">
          <div
            class="fixed inset-0 z-[99]"
            aria-hidden="true"
            @click="closeContextMenu"
          />
          <div
            class="fixed z-[100] min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
            @click.stop
          >
            <button
              type="button"
              class="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground"
              @click="runContextAction('close')"
            >
              Закрыть
            </button>
            <button
              type="button"
              class="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground"
              @click="runContextAction('closeOthers')"
            >
              Закрыть другие
            </button>
            <button
              type="button"
              class="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground"
              @click="runContextAction('closeAllToLeft')"
            >
              Закрыть все слева
            </button>
            <button
              type="button"
              class="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground"
              @click="runContextAction('closeAllToRight')"
            >
              Закрыть все справа
            </button>
          </div>
        </template>
      </Teleport>

      <!-- CONTENT: прокрутка только здесь, вкладки остаются сверху -->
      <div class="flex-1 min-h-0 min-w-0 overflow-auto">
        <div v-if="tabs.length === 0" class="h-full min-h-0" aria-hidden="true" />

        <TabsContent
          v-for="tab in tabs"
          :key="tab.id"
          :value="tab.id"
          class="h-full m-0"
        >
          <div
            v-if="activeId === tab.id"
            class="h-full"
          >
            <component
              :is="resolved.component"
              v-if="resolved"
              v-bind="resolved.props || {}"
              :key="`${tab.id}-${activeId}`"
              class="h-full"
            />
            <div v-else class="p-4 text-sm text-muted-foreground">
              Загрузка редактора...
            </div>
          </div>
        </TabsContent>
      </div>
    </Tabs>
  </div>
</template>
