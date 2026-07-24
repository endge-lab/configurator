<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text, style/max-statements-per-line */
import { Boxes, GitBranch, Play, TriangleAlert } from 'lucide-vue-next'
import { computed } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'

const preview = EndgeIDE.runtimePreview
const prompt = computed(() => preview.occurrencePrompt.value)
const open = computed(() => prompt.value != null)
const targetLabel = computed(() => prompt.value?.target.entityType === 'component-sfc'
  ? 'Component SFC'
  : 'Composition')
const promptDescription = computed(() => (prompt.value?.occurrences.length ?? 0) > 1
  ? `${targetLabel.value} «${prompt.value?.target.identity}» используется в нескольких местах. Выберите ветку runtime, которую нужно активировать.`
  : `${targetLabel.value} «${prompt.value?.target.identity}» найден в runtime проекта. Подтвердите активацию ветки.`,
)
const hasLiveRisk = computed(() =>
  prompt.value?.liveMode
  && prompt.value.occurrences.some(item => item.mayExecuteQueries),
)

function setOpen(value: boolean): void {
  if (!value) { preview.chooseOccurrence(null) }
}
</script>

<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="overflow-hidden sm:max-w-2xl">
      <DialogHeader>
        <div class="mb-2 flex size-9 items-center justify-center rounded-md border bg-muted/40">
          <GitBranch class="size-4 text-muted-foreground" />
        </div>
        <DialogTitle>Запустить в контексте проекта</DialogTitle>
        <DialogDescription>
          {{ promptDescription }}
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="hasLiveRisk"
        class="flex gap-3 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-sm"
      >
        <TriangleAlert class="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <div class="font-medium text-foreground">
            Включён Live mode
          </div>
          <div class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Активация отмеченной ветки может выполнить Query из onMount-графа.
          </div>
        </div>
      </div>

      <ScrollArea class="max-h-[52vh]">
        <div class="grid gap-2 pr-3">
          <button
            v-for="occurrence in prompt?.occurrences ?? []"
            :key="occurrence.id"
            type="button"
            class="group w-full rounded-md border bg-background px-3 py-3 text-left transition-colors hover:border-primary/45 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @click="preview.chooseOccurrence(occurrence.id)"
          >
            <div class="flex items-start gap-3">
              <div class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded border bg-muted/50">
                <Boxes class="size-3.5 text-muted-foreground group-hover:text-foreground" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="truncate text-sm font-medium text-foreground">
                    {{ occurrence.path.at(-1) }}
                  </span>
                  <Badge variant="outline" class="h-5 shrink-0 px-1.5 text-[10px] font-normal">
                    {{ occurrence.kind === 'composition' ? 'Composition' : 'Component' }}
                  </Badge>
                  <Badge
                    v-if="prompt?.liveMode && occurrence.mayExecuteQueries"
                    variant="outline"
                    class="h-5 shrink-0 border-amber-500/40 px-1.5 text-[10px] font-normal text-amber-700 dark:text-amber-300"
                  >
                    может выполнить Query
                  </Badge>
                </div>
                <div class="mt-1.5 line-clamp-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {{ occurrence.path.join(' / ') }}
                </div>
              </div>
              <Play class="mt-1 size-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
            </div>
          </button>
        </div>
      </ScrollArea>

      <DialogFooter class="border-t pt-4 sm:justify-between">
        <Button variant="outline" @click="preview.chooseOccurrence('standalone')">
          Запустить standalone
        </Button>
        <Button variant="ghost" @click="preview.chooseOccurrence(null)">
          Отмена
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
