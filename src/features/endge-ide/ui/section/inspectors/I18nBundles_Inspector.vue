<script setup lang="ts">
import type { RI18nBundleEditor } from '@/features/endge-ide/domain/entities/RI18nBundleEditor'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import { computed } from 'vue'

const props = defineProps<{
  tabContext?: {
    document?: {
      editor?: RI18nBundleEditor
      previewModel?: { isSystem?: boolean; id?: string; name?: string }
      component?: unknown
    }
  }
}>()

const editor = computed(() => props.tabContext?.document?.editor ?? null)
const activeModel = computed<boolean>({
  get: () => editor.value?.active !== false,
  set: (value) => {
    if (!editor.value) return
    editor.value.active = value === true
  },
})

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <div v-if="!editor" class="flex items-center justify-center h-full text-sm text-muted-foreground">
    Выберите словарь переводов
  </div>
  <div v-else class="flex flex-col h-full">
    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <label class="flex items-center gap-2 text-sm font-medium">
          <Checkbox v-model:checked="activeModel" />
          Активен
        </label>
        <div class="space-y-2">
          <Label class="text-sm font-medium">Идентификатор</Label>
          <Input :model-value="editor.identity" readonly />
        </div>
        <div class="space-y-2">
          <Label class="text-sm font-medium">Название</Label>
          <Input :model-value="editor.displayName" readonly />
        </div>
      </div>
    </ScrollArea>
    <div class="border-t p-4">
      <Button class="w-full" :disabled="EndgeIDE.busy.value" @click="save">
        Сохранить
      </Button>
    </div>
  </div>
</template>
