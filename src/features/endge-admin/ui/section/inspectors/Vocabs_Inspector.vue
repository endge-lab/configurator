<script setup lang="ts">
import { Endge } from '@endge/core'
import { useSubscribableRefAuto } from '@endge/utils'
import { computed, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'

const props = defineProps<{
  tabContext?: {
    document?: {
      editor?: {
        id?: number | string
        identity: string
        displayName: string
        description?: string
        mode: 'external_payload' | 'internal'
        baseApiUrl?: string
        collectionSlug?: string
        active?: boolean
      }
      previewModel?: { isSystem?: boolean; id?: string; name?: string }
      component?: unknown
    }
  }
}>()

const editor = computed(() => props.tabContext?.document?.editor ?? null)
const vocabsRef = useSubscribableRefAuto(Endge.vocabs)
const activeModel = computed<boolean>({
  get: () => editor.value?.active !== false,
  set: (value) => {
    if (!editor.value)
      return
    editor.value.active = value === true
  },
})

const sampleCollapsed = ref(true)
const sampleJson = ref('')
const sampleError = ref('')
const canLoadSample = computed(() => editor.value?.mode === 'external_payload' && Number(editor.value?.id) > 0)

watch(
  () => [editor.value?.id, editor.value?.mode] as const,
  () => {
    sampleJson.value = ''
    sampleError.value = ''
    sampleCollapsed.value = true
  },
)

function syncSampleFromCache(): void {
  if (!canLoadSample.value || !editor.value?.id)
    return void (sampleJson.value = '')

  sampleError.value = ''
  try {
    const docs = Endge.vocabs.getValuesById(editor.value.id)
    const first = docs?.[0]
    if (first == null) {
      sampleJson.value = 'Нет данных'
      return
    }
    sampleJson.value = JSON.stringify(first, null, 2)
  }
  catch (error: any) {
    sampleError.value = String(error?.message ?? 'Не удалось загрузить пример')
  }
}

watch(
  () => [editor.value?.id, vocabsRef.value.loading] as const,
  (_value, prev) => {
    const wasLoading = prev?.[1] === true
    const nowLoading = vocabsRef.value.loading === true
    if (wasLoading && !nowLoading)
      syncSampleFromCache()
  }
)

async function save(): Promise<void> {
  await EndgeAdmin.tabs.save()
}
</script>

<template>
  <div v-if="!editor" class="flex items-center justify-center h-full text-sm text-muted-foreground">
    Выберите словарь
  </div>
  <div v-else class="flex flex-col h-full">
    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <label class="flex items-center gap-2 text-sm font-medium">
          <Checkbox v-model:checked="activeModel" />
          Активен
        </label>

        <div class="space-y-2">
          <label class="text-sm font-medium">Идентификатор</label>
          <Input :model-value="editor.identity" readonly />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Название</label>
          <Input :model-value="editor.displayName" readonly />
        </div>

        <div
          v-if="canLoadSample"
          class="space-y-2 border-t pt-4"
        >
          <button
            type="button"
            class="flex items-center gap-2 w-full text-left text-sm font-medium text-foreground hover:opacity-80"
            @click="sampleCollapsed = !sampleCollapsed"
          >
            <span class="transition-transform" :class="sampleCollapsed ? '' : 'rotate-90'">▶</span>
            Пример из словаря
          </button>
          <div v-if="!sampleCollapsed" class="space-y-2">
            <p v-if="sampleError" class="text-xs text-destructive">
              {{ sampleError }}
            </p>
            <pre v-else-if="sampleJson" class="p-3 rounded-md bg-muted text-xs overflow-auto max-h-56">{{ sampleJson }}</pre>
            <p v-else class="text-xs text-muted-foreground">Загрузите словарь в редакторе, чтобы увидеть первый документ.</p>
          </div>
        </div>
      </div>
    </ScrollArea>

    <div class="border-t p-4">
      <Button class="w-full" :disabled="EndgeAdmin.busy.value" @click="save">
        Сохранить
      </Button>
    </div>
  </div>
</template>
