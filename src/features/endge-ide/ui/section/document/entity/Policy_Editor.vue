<script setup lang="ts">
import { Loader2, Save, Shield } from 'lucide-vue-next'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const tabs = EndgeIDE.tabs
const editor = computed(() => tabs.documentEditorModel.value as { id: number | string; identity: string; displayName: string; description: string } | null ?? null)

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <div class="p-3 border-b flex items-center gap-3 shrink-0">
      <div class="size-9 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
        <Shield class="size-4 text-sky-500" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-lg font-semibold truncate">
          Политика - {{ editor?.displayName ?? '-' }}
        </div>
        <div class="text-xs text-muted-foreground truncate">
          id: {{ editor?.id ?? '-' }} · identity: {{ editor?.identity ?? '-' }}
        </div>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" aria-label="Сохранить" :disabled="EndgeIDE.busy.value" @click="save">
              <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
              <Save v-else class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Сохранить</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>

    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <div class="space-y-2">
          <Label>Идентификатор</Label>
          <input
            :value="editor?.identity ?? ''"
            class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="например: default-policy"
            @input="editor && (editor.identity = (($event.target as HTMLInputElement).value ?? ''))"
          >
        </div>
        <div class="space-y-2">
          <Label>Название</Label>
          <input
            :value="editor?.displayName ?? ''"
            class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Отображаемое имя"
            @input="editor && (editor.displayName = (($event.target as HTMLInputElement).value ?? ''))"
          >
        </div>
        <div class="space-y-2">
          <Label>Описание</Label>
          <Textarea
            :model-value="editor?.description ?? ''"
            class="min-h-[80px] resize-y"
            placeholder="Описание политики"
            @update:model-value="(v) => editor && (editor.description = String(v ?? ''))"
          />
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
