<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type {
  DiagnosticsAttributeValue,
  DiagnosticsEntityRef,
  DiagnosticsProblem,
  DiagnosticsProblemPhase,
  DiagnosticsProblemSeverity,
} from '@endge/core'
import type { Component } from 'vue'

import { Endge } from '@endge/core'
import {
  Braces,
  CircleAlert,
  CircleCheck,
  Clock3,
  FileCode2,
  Info,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSmartTabSelection } from '@/components/ui/smart-tabs'
import { useSubscribableModuleRef } from '@/features/endge-ide/model/diagnostics/use-subscribable-module-ref'

const props = defineProps<{
  entityRef?: DiagnosticsEntityRef
  problems?: readonly DiagnosticsProblem[]
}>()

const problemsRevision = useSubscribableModuleRef(Endge.diagnostics.problems)
const activePhase = useSmartTabSelection<DiagnosticsProblemPhase>(
  'diagnostics.active-phase',
  'build',
  ['authoring', 'build', 'runtime'],
)
const selectedProblemId = ref<string | null>(null)

const phaseLabels: Record<DiagnosticsProblemPhase, string> = {
  authoring: 'Authoring',
  build: 'Build',
  runtime: 'Runtime',
}

const entityProblems = computed(() => {
  if (props.problems) {
    return props.problems
  }
  void problemsRevision.value
  if (!props.entityRef) {
    return []
  }
  return Endge.diagnostics.problems.query({
    entityTypes: [props.entityRef.entityType],
    entityId: props.entityRef.id,
  })
})
const phases = computed(() => (['authoring', 'build', 'runtime'] as const)
  .filter(phase => entityProblems.value.some(problem => problem.owner.phase === phase)))
const activeProblems = computed(() => entityProblems.value.filter(problem => problem.owner.phase === activePhase.value))
const selectedProblem = computed(() => {
  return activeProblems.value.find(problem => problem.id === selectedProblemId.value) ?? activeProblems.value[0] ?? null
})

/** Синхронизирует выбранную phase и problem после обновления core registry. */
function synchronizeProblemSelection(): void {
  if (!phases.value.includes(activePhase.value)) {
    activePhase.value = phases.value[0] ?? 'build'
  }
  if (!activeProblems.value.some(problem => problem.id === selectedProblemId.value)) {
    selectedProblemId.value = activeProblems.value[0]?.id ?? null
  }
}

/** Выбирает problem внутри активной phase-вкладки. */
function selectProblem(problem: DiagnosticsProblem): void {
  selectedProblemId.value = problem.id
}

/** Возвращает icon для уровня problem severity. */
function severityIcon(severity: DiagnosticsProblemSeverity): Component {
  if (severity === 'fatal' || severity === 'error') {
    return CircleAlert
  }
  if (severity === 'warning') {
    return TriangleAlert
  }
  return Info
}

/** Возвращает цветовые классы уровня problem severity. */
function severityClasses(severity: DiagnosticsProblemSeverity): string {
  if (severity === 'fatal') {
    return 'border-rose-600/35 bg-rose-600/5 text-rose-600 dark:text-rose-400'
  }
  if (severity === 'error') {
    return 'border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400'
  }
  if (severity === 'warning') {
    return 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400'
  }
  return 'border-sky-500/30 bg-sky-500/5 text-sky-600 dark:text-sky-400'
}

/** Форматирует flat diagnostics attribute для человекочитаемой детализации. */
function formatAttribute(value: DiagnosticsAttributeValue): string {
  return Array.isArray(value) ? value.join(', ') : String(value)
}

/** Форматирует timestamp последнего обновления problem. */
function formatUpdatedAt(timestamp: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)
}

watch(entityProblems, synchronizeProblemSelection, { immediate: true })
watch(activePhase, synchronizeProblemSelection)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background" data-endge-entity-problems-panel>
    <Tabs v-if="entityProblems.length" v-model="activePhase" class="flex min-h-0 flex-1 flex-col">
      <div class="shrink-0 border-b px-4 pt-2">
        <TabsList class="h-8 bg-transparent p-0">
          <TabsTrigger
            v-for="phase in phases"
            :key="phase"
            :value="phase"
            class="h-8 rounded-none border-b-2 border-transparent bg-transparent px-3 text-xs shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            {{ phaseLabels[phase] }}
            <span class="ml-1.5 text-[9px] tabular-nums text-muted-foreground">
              {{ entityProblems.filter(problem => problem.owner.phase === phase).length }}
            </span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent
        v-for="phase in phases"
        :key="phase"
        :value="phase"
        class="m-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
      >
        <div class="grid h-full min-h-0 grid-cols-[minmax(260px,0.72fr)_minmax(360px,1.28fr)]">
          <div class="min-h-0 overflow-auto border-r bg-muted/[0.12] p-3">
            <div class="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Problems in {{ phaseLabels[phase] }}
            </div>
            <div class="space-y-1.5">
              <button
                v-for="problem in activeProblems"
                :key="problem.id"
                type="button"
                class="flex w-full items-start gap-2 rounded-md border p-2.5 text-left transition-colors"
                :class="[
                  severityClasses(problem.severity),
                  selectedProblem?.id === problem.id ? 'ring-1 ring-primary/55' : 'hover:border-foreground/20 hover:bg-muted/50',
                ]"
                @click="selectProblem(problem)"
              >
                <component :is="severityIcon(problem.severity)" class="mt-0.5 size-3.5 shrink-0" />
                <span class="min-w-0 flex-1">
                  <span class="line-clamp-2 text-xs font-medium leading-4 text-foreground">{{ problem.message }}</span>
                  <span class="mt-1 block truncate font-mono text-[9px] opacity-80">{{ problem.code }}</span>
                </span>
              </button>
            </div>
          </div>

          <article v-if="selectedProblem" class="min-h-0 overflow-auto">
            <div class="mx-auto max-w-4xl p-5 lg:p-7">
              <div class="mb-5 flex items-start gap-3">
                <span class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border" :class="severityClasses(selectedProblem.severity)">
                  <component :is="severityIcon(selectedProblem.severity)" class="size-4" />
                </span>
                <div class="min-w-0 flex-1">
                  <div class="mb-1 flex flex-wrap items-center gap-2">
                    <span class="rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide" :class="severityClasses(selectedProblem.severity)">
                      {{ selectedProblem.severity }}
                    </span>
                    <code class="text-[10px] text-muted-foreground">{{ selectedProblem.code }}</code>
                  </div>
                  <h2 class="text-base font-semibold leading-6 text-foreground">
                    {{ selectedProblem.message }}
                  </h2>
                </div>
              </div>

              <section class="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
                <div class="bg-background p-3">
                  <div class="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <Clock3 class="size-3" /> Phase
                  </div>
                  <div class="text-xs font-medium">
                    {{ phaseLabels[selectedProblem.owner.phase] }}
                  </div>
                </div>
                <div class="bg-background p-3">
                  <div class="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <Clock3 class="size-3" /> Updated
                  </div>
                  <div class="text-xs font-medium">
                    {{ formatUpdatedAt(selectedProblem.updatedAt) }}
                  </div>
                </div>
                <div v-if="selectedProblem.sourcePath" class="bg-background p-3 sm:col-span-2">
                  <div class="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <FileCode2 class="size-3" /> Source
                  </div>
                  <div class="break-all font-mono text-xs">
                    {{ selectedProblem.sourcePath }}
                  </div>
                  <div v-if="selectedProblem.start != null" class="mt-1 text-[10px] text-muted-foreground">
                    Range: {{ selectedProblem.start }}<template v-if="selectedProblem.end != null">
                      –{{ selectedProblem.end }}
                    </template>
                  </div>
                </div>
                <div v-if="selectedProblem.traceId" class="bg-background p-3">
                  <div class="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Trace ID
                  </div>
                  <div class="break-all font-mono text-[10px]">
                    {{ selectedProblem.traceId }}
                  </div>
                </div>
                <div v-if="selectedProblem.recordId != null" class="bg-background p-3">
                  <div class="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Telemetry record
                  </div>
                  <div class="font-mono text-xs">
                    #{{ selectedProblem.recordId }}
                  </div>
                </div>
                <div v-if="selectedProblem.owner.runtimeId" class="bg-background p-3">
                  <div class="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Runtime instance
                  </div>
                  <div class="break-all font-mono text-[10px]">
                    {{ selectedProblem.owner.runtimeId }}
                  </div>
                </div>
              </section>

              <details v-if="selectedProblem.attributes && Object.keys(selectedProblem.attributes).length" class="mt-4 overflow-hidden rounded-lg border">
                <summary class="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-medium hover:bg-muted/40">
                  <Braces class="size-3.5 text-muted-foreground" />
                  Technical attributes
                </summary>
                <dl class="grid grid-cols-[minmax(120px,0.45fr)_minmax(0,1fr)] border-t text-xs">
                  <template v-for="(value, key) in selectedProblem.attributes" :key="key">
                    <dt class="border-b border-r bg-muted/20 px-3 py-2 font-mono text-[10px] text-muted-foreground last:border-b-0">
                      {{ key }}
                    </dt>
                    <dd class="break-all border-b px-3 py-2 font-mono text-[10px] last:border-b-0">
                      {{ formatAttribute(value) }}
                    </dd>
                  </template>
                </dl>
              </details>
            </div>
          </article>
        </div>
      </TabsContent>
    </Tabs>

    <div v-else class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
      <span class="relative">
        <ShieldAlert class="size-12 opacity-20" stroke-width="1.2" />
        <CircleCheck class="absolute -bottom-1 -right-1 size-5 text-emerald-500" />
      </span>
      <div class="text-sm font-medium text-foreground">
        Проблем не обнаружено
      </div>
      <div class="max-w-sm text-xs leading-5">
        Для этой сущности нет актуальных authoring, build или runtime problems.
      </div>
    </div>
  </div>
</template>
