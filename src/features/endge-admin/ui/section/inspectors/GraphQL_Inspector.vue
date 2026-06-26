<script setup lang="ts">
import { Endge } from '@endge/core'
import { useDomainStore } from '@endge/vue'

import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'
import { Loader2, Play } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import EntityInheritedInspector from '@/features/endge-admin/ui/section/inspectors/EntityInherited_Inspector.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const props = defineProps<{
  tabContext?: { document?: { editor?: any; previewModel?: any; component?: any } }
}>()

const domainStore = useDomainStore()
const editor = computed(() => props.tabContext?.document?.editor ?? null)

const componentInputOptions = domainStore.types.map((x) => ({ name: x.name, code: x.name }))
const componentTypeOptions = domainStore.queriesNames.map((x: string) => ({ name: x, code: x }))

const runQueryLoading = ref(false)

async function save(): Promise<void> {
  await EndgeAdmin.tabs.save()
}

async function runQuery(): Promise<void> {
  const ed = editor.value
  if (!ed) {
    toast.error('Нет редактора запроса')
    return
  }
  const query = Endge.domain.getQuery(ed.id ?? ed.identity)
  if (!query) {
    toast.error('Запрос не найден в домене')
    return
  }
  runQueryLoading.value = true
  try {
    const result = await Endge.query.run(query, {})
    console.log('[GraphQL_Inspector] Результат запроса:', result)
    toast.success('Запрос выполнен', { description: 'Результат выведен в консоль' })
  } catch (e: any) {
    console.error('[GraphQL_Inspector] Ошибка выполнения запроса:', e)
    toast.error('Ошибка выполнения запроса', { description: e?.message ?? String(e) })
  } finally {
    runQueryLoading.value = false
  }
}
</script>

<template>
  <div v-if="!editor" class="flex items-center justify-center h-full text-sm text-muted-foreground">
    Выберите документ
  </div>
  <div v-else class="flex flex-col h-full">
    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">ID запроса</label>
          <Input :model-value="editor.id" readonly />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Название запроса</label>
          <Input v-model="editor.name" />
        </div>

        <div class="space-y-2">
          <EntityInheritedInspector :tab-context="tabContext" />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Тип запроса</label>
          <Select :model-value="editor.type" disabled>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in componentTypeOptions" :key="opt.code" :value="opt.code">
                {{ opt.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Возвращаемый тип</label>
          <Select v-model="editor.returnField">
            <SelectTrigger>
              <SelectValue placeholder="Выберите возвращаемый тип" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in componentInputOptions" :key="opt.code" :value="opt.code">
                {{ opt.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </ScrollArea>

    <div class="border-t p-4 flex items-center gap-2">
      <Button class="flex-1 min-w-0" :disabled="EndgeAdmin.busy.value" @click="save">
        <Loader2 v-if="EndgeAdmin.busy.value" class="size-4 animate-spin mr-2" />
        {{ EndgeAdmin.busy.value ? 'Сохранение…' : 'Сохранить' }}
      </Button>
      <TooltipProvider :delay-duration="300">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              type="button"
              variant="outline"
              size="icon"
              class="h-8 w-8 shrink-0"
              :disabled="runQueryLoading"
              @click="runQuery"
            >
              <Play class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Выполнить запрос (результат в консоли)</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>
</template>
