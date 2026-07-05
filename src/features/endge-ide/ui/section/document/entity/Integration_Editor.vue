<script setup lang="ts">
import { Loader2, Plug, Save } from 'lucide-vue-next'
import { computed } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const tabs = EndgeIDE.tabs
const editor = computed(() => tabs.documentEditorModel.value as { id: number | string; identity: string; displayName: string; description: string } | null ?? null)
const documentModel = computed(() => tabs.documentModel.value as { isSystem?: boolean } | null ?? null)
const isSystem = computed(() => documentModel.value?.isSystem === true)

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <div class="p-3 border-b flex items-center gap-3 shrink-0">
      <div class="size-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
        <Plug class="size-4 text-violet-500" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-lg font-semibold truncate">
          Интеграция - {{ editor?.displayName ?? '-' }}
        </div>
        <div class="text-xs text-muted-foreground truncate">
          id: {{ editor?.id ?? '-' }} · identity: {{ editor?.identity ?? '-' }}
        </div>
        <Badge v-if="isSystem" variant="outline" class="rounded-full border-orange-200 bg-amber-500/10 text-amber-700 font-normal dark:border-orange-300/50 dark:bg-amber-500/15 dark:text-amber-600">
          Системная
        </Badge>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" aria-label="Сохранить" :disabled="isSystem || EndgeIDE.busy.value" @click="save">
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
          <Label>Описание</Label>
          <textarea
            :value="editor?.description ?? ''"
            :disabled="isSystem"
            class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Краткое описание интеграции"
            @input="editor && (editor.description = (($event.target as HTMLTextAreaElement).value ?? ''))"
          />
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
