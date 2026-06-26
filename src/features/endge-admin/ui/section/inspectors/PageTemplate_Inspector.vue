<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'

import { Endge } from '@endge/core'
import { toast } from 'vue-sonner'
import { useSubscribableRefAuto } from '@endge/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'

const props = defineProps<{
  tabContext?: {
    document?: {
      editor?: {
        identity: string
        displayName: string
        description?: string
        areas: Array<{
          identity: string
          title?: string
          description?: string
        }>
      }
      previewModel?: any
      component?: any
    }
  }
}>()

const editor = computed(() => props.tabContext?.document?.editor ?? null)

const debuggerRef = useSubscribableRefAuto(Endge.runtimeDebugger)

const firstTab = computed(() => debuggerRef.value.tabs[0] ?? null)

const targets = computed(() => {
  const tab = firstTab.value
  if (!tab)
    return [] as string[]
  return Endge.runtimeDebugger.getAnalysis(tab.id) ?? []
})

const lastRequestedTabId = ref<string | null>(null)

function requestTemplateAnalysis(): void {
  const tab = firstTab.value
  if (!tab)
    return
  const tabId = String(tab.id ?? '').trim()
  if (!tabId)
    return

  lastRequestedTabId.value = tabId

  Endge.runtimeDebugger.sendCommand('template-analysis', {
    tabId,
    url: tab.url ?? '',
    title: tab.title ?? '',
  })
}

async function save(): Promise<void> {
  await EndgeAdmin.tabs.save()
}

function applyTargetsToTemplate(): void {
  const ed = editor.value
  const list = targets.value
  if (!ed || !Array.isArray(ed.areas) || !list.length)
    return

  const existing = ed.areas
  for (const t of list) {
    const id = String(t ?? '').trim()
    if (!id)
      continue
    if (existing.some(a => a.identity === id))
      continue
    existing.push({
      identity: id,
      title: id,
      description: '',
    })
  }

  toast.success('Области обновлены', { description: 'Список областей шаблона обновлён по Runtime Debug' })
}

watch(
  () => firstTab.value?.id,
  (id) => {
    if (!id)
      return
    if (lastRequestedTabId.value === id && (Endge.runtimeDebugger.getAnalysis(id) ?? []).length > 0)
      return
    requestTemplateAnalysis()
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="!editor" class="flex items-center justify-center h-full text-sm text-muted-foreground">
    Выберите шаблон страницы
  </div>
  <div v-else class="flex flex-col h-full">
    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Идентификатор шаблона</label>
          <Input v-model="editor.identity" placeholder="page-template.default" />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Название</label>
          <Input v-model="editor.displayName" placeholder="Шаблон макета" />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Описание</label>
          <Textarea
            v-model="editor.description"
            rows="3"
            placeholder="Краткое описание шаблона и его назначения"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Области из Runtime Debug (первая вкладка)</label>
          <p class="text-xs text-muted-foreground">
            Анализ шаблона выполняется автоматически по первой зарегистрированной вкладке Runtime Debug. Ниже список
            найденных data-target.
          </p>

          <div v-if="firstTab" class="text-xs text-muted-foreground">
            Вкладка: {{ firstTab.title || firstTab.url || firstTab.id }}
          </div>

          <div v-if="targets.length" class="mt-1 space-y-1">
            <ul class="list-disc list-inside text-xs text-muted-foreground">
              <li
                v-for="t in targets"
                :key="t"
              >
                {{ t }}
              </li>
            </ul>
            <Button
              size="sm"
              variant="outline"
              class="mt-2"
              @click="applyTargetsToTemplate"
            >
              Вставить области в шаблон
            </Button>
          </div>
          <p v-else class="text-xs text-muted-foreground">
            Областей пока не найдено. Убедитесь, что есть активная вкладка Runtime Debug и на клиенте подключён шаблон.
          </p>
        </div>
      </div>
    </ScrollArea>

    <div class="border-t p-4">
      <Button class="w-full" :disabled="EndgeAdmin.busy.value" @click="save">
        <Loader2 v-if="EndgeAdmin.busy.value" class="size-4 animate-spin mr-2" />
        {{ EndgeAdmin.busy.value ? 'Сохранение…' : 'Сохранить' }}
      </Button>
    </div>
  </div>
</template>

