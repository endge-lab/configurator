<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { DiagnosticsProblemSeverity } from '@endge/core'

import { Endge } from '@endge/core'
import { ChevronRight, CircleCheck, RefreshCw, ShieldAlert } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import ProblemsTreeEntityNode from '@/features/endge-ide/ui/widgets/components/ProblemsTreeEntityNode.vue'

const problems = EndgeIDE.problems
const isAnalyzing = ref(false)
const collapsedGroups = ref(new Set<DiagnosticsProblemSeverity>())

const problemCount = computed(() => problems.entries.value.reduce((total, entry) => total + entry.problems.length, 0))
const errorCount = computed(() => problems.entries.value.reduce((total, entry) => {
  return total + entry.problems.filter(problem => problem.severity === 'fatal' || problem.severity === 'error').length
}, 0))
const warningCount = computed(() => problems.entries.value.reduce((total, entry) => {
  return total + entry.problems.filter(problem => problem.severity === 'warning').length
}, 0))

/** Запускает project build, который атомарно обновляет актуальные build problems. */
async function runProjectAnalysis(): Promise<void> {
  if (isAnalyzing.value) {
    return
  }
  isAnalyzing.value = true
  try {
    await Endge.build()
  }
  finally {
    isAnalyzing.value = false
  }
}

/** Сворачивает или раскрывает severity-ветку дерева. */
function toggleGroup(severity: DiagnosticsProblemSeverity): void {
  const next = new Set(collapsedGroups.value)
  if (next.has(severity)) {
    next.delete(severity)
  }
  else {
    next.add(severity)
  }
  collapsedGroups.value = next
}

/** Возвращает цвет presentation-маркера для severity-ветки. */
function severityMarkerClass(severity: DiagnosticsProblemSeverity): string {
  if (severity === 'fatal') {
    return 'bg-rose-600'
  }
  if (severity === 'error') {
    return 'bg-red-500'
  }
  if (severity === 'warning') {
    return 'bg-amber-500'
  }
  return 'bg-sky-500'
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background" data-endge-problems-tree>
    <div class="flex min-h-10 shrink-0 items-center gap-2 border-b px-2.5">
      <div class="flex min-w-0 flex-1 items-baseline gap-2">
        <span class="text-xs font-semibold">Problems</span>
        <span class="text-[10px] tabular-nums text-muted-foreground">{{ problemCount }}</span>
      </div>
      <div v-if="problemCount" class="flex items-center gap-1 text-[9px] tabular-nums">
        <span v-if="errorCount" class="text-red-500">{{ errorCount }} errors</span>
        <span v-if="warningCount" class="text-amber-500">{{ warningCount }} warnings</span>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="size-7"
              :disabled="isAnalyzing"
              @click="runProjectAnalysis"
            >
              <RefreshCw class="size-3.5" :class="isAnalyzing && 'animate-spin'" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Повторить анализ проекта</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>

    <div v-if="problems.groups.value.length" class="min-h-0 flex-1 overflow-auto py-1">
      <section v-for="group in problems.groups.value" :key="group.severity" class="border-b border-border/45 py-1 last:border-b-0">
        <button
          type="button"
          class="flex h-8 w-full items-center gap-1.5 px-2 text-left text-[11px] font-semibold text-muted-foreground hover:bg-muted/55 hover:text-foreground"
          :aria-expanded="!collapsedGroups.has(group.severity)"
          @click="toggleGroup(group.severity)"
        >
          <ChevronRight
            class="size-3 shrink-0 transition-transform"
            :class="!collapsedGroups.has(group.severity) && 'rotate-90'"
          />
          <span class="size-1.5 shrink-0 rounded-full" :class="severityMarkerClass(group.severity)" />
          <span class="min-w-0 flex-1 truncate">{{ group.title }}</span>
          <span class="tabular-nums text-[10px] font-normal">{{ group.entries.length }} / {{ group.problemCount }}</span>
        </button>
        <div v-if="!collapsedGroups.has(group.severity)">
          <ProblemsTreeEntityNode
            v-for="entry in group.entries"
            :key="entry.key"
            :entry="entry"
          />
        </div>
      </section>
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-5 py-10 text-center text-muted-foreground">
      <span class="relative">
        <ShieldAlert class="size-9 opacity-20" stroke-width="1.25" />
        <CircleCheck class="absolute -bottom-1 -right-1 size-4 text-emerald-500" />
      </span>
      <div class="text-xs font-medium text-foreground">
        Проблем не обнаружено
      </div>
      <div class="max-w-52 text-[10px] leading-4">
        Registry актуален. Повторите анализ после изменения проекта.
      </div>
    </div>

    <div class="shrink-0 border-t px-3 py-2 text-[10px] leading-4 text-muted-foreground">
      Escape возвращает к Project. Выбор сущности открывает её problems справа.
    </div>
  </div>
</template>
