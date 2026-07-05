<script setup lang="ts">
import { computed } from 'vue'
import { Loader2 } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const props = defineProps<{
  tabContext?: { document?: { editor?: { identity: string; displayName: string }; previewModel?: unknown; component?: unknown } }
}>()

const editor = computed(() => props.tabContext?.document?.editor ?? null)
const model = computed(() => props.tabContext?.document?.previewModel ?? props.tabContext?.document?.component ?? editor.value)

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <div v-if="!model" class="flex items-center justify-center h-full text-sm text-muted-foreground">
    Выберите профиль настроек
  </div>
  <div v-else class="flex flex-col h-full">
    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <div class="space-y-2">
          <Label class="text-sm font-medium">Идентификатор</Label>
          <Input
            :model-value="editor?.identity ?? (model as { identity?: string })?.identity ?? ''"
            placeholder="general"
            readonly
            class="bg-muted/50"
          />
        </div>
        <div class="space-y-2">
          <Label class="text-sm font-medium">Название</Label>
          <Input
            :model-value="editor?.displayName ?? (model as { displayName?: string })?.displayName ?? ''"
            placeholder="Отображаемое имя"
            readonly
            class="bg-muted/50"
          />
        </div>
        <p class="text-xs text-muted-foreground">
          Полное редактирование - во вкладке редактора.
        </p>
      </div>
    </ScrollArea>
    <div class="border-t p-4">
      <Button class="w-full" :disabled="EndgeIDE.busy.value" @click="save">
        <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin mr-2" />
        {{ EndgeIDE.busy.value ? 'Сохранение…' : 'Сохранить' }}
      </Button>
    </div>
  </div>
</template>
