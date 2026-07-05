<script setup lang="ts">
import { computed } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const props = defineProps<{
  tabContext?: {
    document?: {
      editor?: {
        identity: string
        displayName: string
        description?: string
        tree?: unknown[]
      }
      previewModel?: { isSystem?: boolean; id?: string; name?: string }
      component?: unknown
    }
  }
}>()

const editor = computed(() => props.tabContext?.document?.editor ?? null)
const model = computed(() => props.tabContext?.document?.previewModel ?? props.tabContext?.document?.component ?? editor.value)
const isSystem = computed(() => (model.value as { isSystem?: boolean } | null)?.isSystem === true)
const groupsCount = computed(() =>
  (editor.value?.tree?.length ?? 0)
  || ((model.value as { tree?: unknown[] } | null)?.tree?.length ?? 0)
)

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <div v-if="!model" class="flex items-center justify-center h-full text-sm text-muted-foreground">
    Выберите навигацию
  </div>
  <div v-else class="flex flex-col h-full">
    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <Badge
          v-if="isSystem"
          variant="outline"
          class="rounded-full border-orange-200 bg-amber-500/10 text-amber-700 font-normal"
        >
          Системная
        </Badge>

        <div class="space-y-2">
          <label class="text-sm font-medium">Идентификатор</label>
          <Input
            :model-value="editor?.identity ?? (model as { id?: string })?.id ?? ''"
            :disabled="isSystem"
            placeholder="main"
            @update:model-value="(v) => editor && (editor.identity = String(v ?? ''))"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Название</label>
          <Input
            :model-value="editor?.displayName ?? (model as { name?: string })?.name ?? ''"
            :disabled="isSystem"
            placeholder="Главное меню"
            @update:model-value="(v) => editor && (editor.displayName = String(v ?? ''))"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Описание</label>
          <Textarea
            :model-value="editor?.description ?? ''"
            :disabled="isSystem"
            rows="2"
            placeholder="Описание"
            @update:model-value="(v) => editor && (editor.description = String(v ?? ''))"
          />
        </div>

        <p class="text-xs text-muted-foreground">
          Групп: {{ groupsCount }}
        </p>
      </div>
    </ScrollArea>

    <div class="border-t p-4">
      <Button class="w-full" :disabled="isSystem || EndgeIDE.busy.value" @click="save">
        <span v-if="EndgeIDE.busy.value" class="inline-flex items-center gap-2">
          <span class="h-4 w-4 rounded-full border border-current border-t-transparent animate-spin" />
          Сохранение…
        </span>
        <span v-else>Сохранить</span>
      </Button>
    </div>
  </div>
</template>
