<script setup lang="ts">
import { Endge } from '@endge/core'
import { useSubscribableRefAuto } from '@endge/utils'
import { computed, onMounted, watch } from 'vue'
import { toast } from 'vue-sonner'

import { ScrollArea } from '@/components/ui/scroll-area'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import { setPulseActiveTab } from '@/features/endge-ide/model/pulse/pulse.mock.ts'

const debuggerRef = useSubscribableRefAuto(Endge.runtimeDebugger)

onMounted(() => {
  setPulseActiveTab('diagnostics')
  EndgeIDE.tabs.openPulseTab()
})

const tabs = computed(() => debuggerRef.value.tabs ?? [])

watch(
  () => (debuggerRef.value.isListening ? tabs.value.length : 0),
  (newCount, oldCount) => {
    const prev = oldCount ?? 0

    if (prev === 0 && newCount > 0) {
      toast.success('Debug режим подключён', {
        description: 'Найдена активная вкладка Runtime Debug',
      })
    }
    else if (prev > 0 && newCount === 0) {
      toast.info('Клиенты Runtime Debug отключены', {
        description: 'Активные вкладки Runtime Debug не обнаружены',
      })
    }
  },
  { immediate: true },
)

function onStart(): void {
  Endge.runtimeDebugger.start()
  toast.success('Runtime Debug запущен', { description: 'Канал прослушивается' })
}

function onStop(): void {
  Endge.runtimeDebugger.stop()
  toast.info('Runtime Debug остановлен', { description: 'Список вкладок очищен' })
}

function openRuntimeDebugTab(tab: { id: string; url?: string; title?: string }): void {
  EndgeIDE.tabs.openRuntimeDebugTab(tab)
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="shrink-0 border-b bg-muted/30 px-3 py-2">
      <p class="text-xs text-muted-foreground">
        Работаем с данными текущей административной панели. Метрики и трассы — во вкладке «Диагностика».
      </p>
    </div>
    <div class="flex items-center justify-between gap-2 px-4 py-2 border-b shrink-0">
      <span class="text-sm font-medium">Канал</span>
      <template v-if="debuggerRef.isListening">
        <button
          type="button"
          class="text-xs rounded-md px-2 py-1 bg-muted hover:bg-muted/80"
          @click="onStop"
        >
          Остановить
        </button>
      </template>
      <template v-else>
        <button
          type="button"
          class="text-xs rounded-md px-2 py-1 bg-muted hover:bg-muted/80"
          @click="onStart"
        >
          Запустить
        </button>
      </template>
    </div>

    <template v-if="!debuggerRef.isListening">
      <div class="flex-1 min-h-0 p-4 overflow-auto">
        <p class="text-sm text-muted-foreground">
          Канал остановлен. Нажмите «Запустить», чтобы снова получать список вкладок.
        </p>
      </div>
    </template>

    <template v-else-if="tabs.length === 0">
      <div class="flex-1 min-h-0 p-4 overflow-auto">
        <p class="text-sm text-muted-foreground">
          Для запуска системы отладки активируйте дебаг режим в другой вкладке проекта.
        </p>
        <p class="text-xs text-muted-foreground mt-2">
          В консоли разработчика той вкладки выполните: <code class="rounded bg-muted px-1">Endge.debugTab()</code>
        </p>
      </div>
    </template>

    <template v-else>
      <div class="flex-1 min-h-0">
        <nav class="h-full border-r flex flex-col bg-muted/30">
          <div class="p-2 border-b text-xs font-medium text-muted-foreground">
            Вкладки
          </div>
          <ScrollArea class="flex-1">
            <ul class="p-1 space-y-1">
              <li
                v-for="tab in tabs"
                :key="tab.id"
              >
                <button
                  type="button"
                  class="w-full text-left rounded-md border px-2 py-1.5 text-xs transition-colors bg-muted/30 hover:bg-accent/60"
                  @click="openRuntimeDebugTab(tab)"
                >
                  <div class="font-medium truncate" :title="tab.title">
                    {{ tab.title || tab.url || tab.id }}
                  </div>
                  <div class="text-muted-foreground truncate mt-0.5" :title="tab.url">
                    {{ tab.url }}
                  </div>
                </button>
              </li>
            </ul>
          </ScrollArea>
        </nav>
      </div>
    </template>
  </div>
</template>
