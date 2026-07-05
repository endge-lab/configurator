<script setup lang="ts">
import { computed } from 'vue'
import { Play } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Endge } from '@endge/core'
import { useSubscribableRefAuto } from '@endge/utils'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

const props = defineProps<{
  tabContext?: {
    debugTab?: {
      id: string
      url?: string
      title?: string
    }
  }
}>()

const debugTab = computed(() => props.tabContext?.debugTab ?? null)

const debuggerRef = useSubscribableRefAuto(Endge.runtimeDebugger)

const targets = computed(() => {
  const tab = debugTab.value
  if (!tab)
    return [] as string[]
  return debuggerRef.value.getAnalysis(tab.id) ?? []
})

function runTemplateAnalysis(): void {
  const tab = debugTab.value
  if (!tab) {
    toast.error('Нет данных вкладки', { description: 'Повторно откройте вкладку из инспектора отладки' })
    return
  }

  Endge.runtimeDebugger.sendCommand('template-analysis', {
    tabId: tab.id,
    url: tab.url ?? '',
    title: tab.title ?? '',
  })

  toast.info('Команда анализа отправлена', { description: `Вкладка: ${tab.id}` })
}
</script>

<template>
  <div class="flex h-full min-h-0">
    <nav class="w-48 shrink-0 border-r flex flex-col bg-muted/20">
      <div class="p-2 border-b text-xs font-medium text-muted-foreground">
        Анализ (Runtime Debug)
      </div>
      <ScrollArea class="flex-1">
        <ul class="p-1 space-y-0.5">
          <li>
            <button
              type="button"
              class="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left bg-accent text-accent-foreground"
            >
              <span class="truncate">Анализ шаблона</span>
            </button>
          </li>
        </ul>
      </ScrollArea>
    </nav>

    <div class="flex-1 min-w-0 flex flex-col">
      <div class="shrink-0 flex items-center justify-between gap-2 px-4 py-2 border-b text-xs text-muted-foreground">
        <span class="font-medium">ID вкладки</span>
        <span class="px-2 py-1 rounded bg-muted text-foreground text-[11px]">
          {{ debugTab?.id || '-' }}
        </span>
      </div>

      <div class="shrink-0 flex items-center gap-2 px-4 py-2 border-b">
        <Button
          size="sm"
          :disabled="!debugTab"
          @click="runTemplateAnalysis"
        >
          <Play class="size-4 mr-1" />
          Запустить анализ
        </Button>
      </div>

      <ScrollArea class="flex-1">
        <div class="p-4 space-y-3 text-sm text-muted-foreground">
          <p>
            Команда анализа шаблона будет отправлена в клиент по каналу Runtime Debug для выбранной вкладки.
          </p>
          <p>
            Сейчас клиентская часть должна просто вывести тестовое сообщение в консоль при получении команды
            <code class="px-1 rounded bg-muted text-xs">template-analysis</code>.
          </p>
          <p v-if="debugTab?.url" class="text-xs text-muted-foreground">
            URL вкладки: {{ debugTab.url }}
          </p>

          <div v-if="targets.length" class="pt-1 space-y-1">
            <p class="text-xs text-muted-foreground">
              Доступные области шаблона (data-target):
            </p>
            <ul class="list-disc list-inside text-xs text-muted-foreground">
              <li
                v-for="t in targets"
                :key="t"
              >
                {{ t }}
              </li>
            </ul>
          </div>
        </div>
      </ScrollArea>
    </div>
  </div>
</template>

