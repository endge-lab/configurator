<script setup lang="ts">
import { computed } from 'vue'
import { Loader2 } from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const props = defineProps<{
  tabContext?: { document?: { editor?: { identity: string; displayName: string }; previewModel?: any; component?: any } }
}>()

const editor = computed(() => props.tabContext?.document?.editor ?? null)
const model = computed(() => props.tabContext?.document?.previewModel ?? props.tabContext?.document?.component ?? editor.value)
const isSystem = computed(() => (model.value as { isSystem?: boolean } | null)?.isSystem === true)

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <div v-if="!model" class="flex items-center justify-center h-full text-sm text-muted-foreground">
    Выберите документ
  </div>
  <div v-else class="flex flex-col h-full">
    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <Badge v-if="isSystem" variant="outline" class="rounded-full border-orange-200 bg-amber-500/10 text-amber-700 font-normal dark:border-orange-300/50 dark:bg-amber-500/15 dark:text-amber-600">
          Системное
        </Badge>
        <div class="space-y-2">
          <label class="text-sm font-medium">Идентификатор</label>
          <Input
            :model-value="editor?.identity ?? model?.id ?? ''"
            :disabled="isSystem"
            placeholder="например: dev"
            @update:model-value="(v) => editor && (editor.identity = String(v ?? ''))"
          />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Название</label>
          <Input
            :model-value="editor?.displayName ?? model?.name ?? ''"
            :disabled="isSystem"
            placeholder="Отображаемое имя"
            @update:model-value="(v) => editor && (editor.displayName = String(v ?? ''))"
          />
        </div>
      </div>
    </ScrollArea>
    <div class="border-t p-4">
      <Button class="w-full" :disabled="isSystem || EndgeIDE.busy.value" @click="save">
        <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin mr-2" />
        {{ EndgeIDE.busy.value ? 'Сохранение…' : 'Сохранить' }}
      </Button>
    </div>
  </div>
</template>
