<script setup lang="ts">
import { ArrowLeftRight, Loader2, Save } from 'lucide-vue-next'
import { computed } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const tabs = EndgeIDE.tabs
const editor = computed(() => tabs.documentEditorModel.value as { id: number | string; identity: string; displayName: string; description: string } | null ?? null)
const documentModel = computed(() => tabs.documentModel.value as { managedBy?: 'system' | 'integration' | 'user' } | null ?? null)
const systemManaged = computed(() => documentModel.value?.managedBy === 'system')
const integrationManaged = computed(() => documentModel.value?.managedBy === 'integration')
const externallyManaged = computed(() => systemManaged.value || integrationManaged.value)

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <div class="p-3 border-b flex items-center gap-3 shrink-0">
      <div class="size-9 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
        <ArrowLeftRight class="size-4 text-cyan-500" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-lg font-semibold truncate">
          Конвертер - {{ editor?.displayName ?? '-' }}
        </div>
        <div class="text-xs text-muted-foreground truncate">
          id: {{ editor?.id ?? '-' }} · identity: {{ editor?.identity ?? '-' }}
        </div>
        <Badge v-if="systemManaged" variant="outline" class="rounded-full border-orange-200 bg-amber-500/10 text-amber-700 font-normal dark:border-orange-300/50 dark:bg-amber-500/15 dark:text-amber-600">
          Системный
        </Badge>
        <Badge v-if="integrationManaged" variant="outline" class="rounded-full border-violet-200 bg-violet-500/10 text-violet-700 font-normal dark:border-violet-300/50 dark:bg-violet-500/15 dark:text-violet-300">
          Управляется интеграцией
        </Badge>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" aria-label="Сохранить" :disabled="externallyManaged || EndgeIDE.busy.value" @click="save">
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
        <div class="text-sm font-semibold">Основное</div>
        <div class="space-y-2">
          <Label>Идентификатор</Label>
          <Input v-model="editor!.identity" :disabled="externallyManaged" />
        </div>
        <div class="space-y-2">
          <Label>Название</Label>
          <Input v-model="editor!.displayName" :disabled="externallyManaged" />
        </div>
        <div class="space-y-2">
          <Label>Описание</Label>
          <textarea
            :value="editor?.description ?? ''"
            :disabled="externallyManaged"
            class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Краткое описание и пример (1–2 строки)"
            @input="editor && (editor.description = (($event.target as HTMLTextAreaElement).value ?? ''))"
          />
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
