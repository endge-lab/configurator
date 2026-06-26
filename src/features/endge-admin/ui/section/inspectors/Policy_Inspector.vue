<script setup lang="ts">
import { computed } from 'vue'
import { Loader2 } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'

const props = defineProps<{
  tabContext?: { document?: { editor?: { identity: string; displayName: string; description: string }; previewModel?: any; component?: any } }
}>()

const editor = computed(() => props.tabContext?.document?.editor ?? null)
const model = computed(() => props.tabContext?.document?.previewModel ?? props.tabContext?.document?.component ?? editor.value)

async function save(): Promise<void> {
  await EndgeAdmin.tabs.save()
}
</script>

<template>
  <div v-if="!model" class="flex items-center justify-center h-full text-sm text-muted-foreground">
    Выберите документ
  </div>
  <div v-else class="flex flex-col h-full">
    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Идентификатор</label>
          <Input
            :model-value="editor?.identity ?? model?.id ?? ''"
            placeholder="например: default-policy"
            @update:model-value="(v) => editor && (editor.identity = String(v ?? ''))"
          />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Название</label>
          <Input
            :model-value="editor?.displayName ?? model?.name ?? ''"
            placeholder="Отображаемое имя"
            @update:model-value="(v) => editor && (editor.displayName = String(v ?? ''))"
          />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Описание</label>
          <Textarea
            :model-value="editor?.description ?? model?.description ?? ''"
            class="min-h-[80px] resize-y"
            placeholder="Описание политики"
            @update:model-value="(v) => editor && (editor.description = String(v ?? ''))"
          />
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
