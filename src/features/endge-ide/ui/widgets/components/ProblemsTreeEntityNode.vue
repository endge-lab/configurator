<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { ProblemsEntityEntry } from '@/features/endge-ide/domain/types/problems-workspace.types'
import type { DomainDocumentType } from '@endge/core'
import type { Component } from 'vue'

import { Box, CircleAlert } from 'lucide-vue-next'
import { computed } from 'vue'

import { getIconComponent } from '@/components/layouts/grid/icons'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import { resolveDiagnosticsDocumentTarget } from '@/features/endge-ide/model/diagnostics/diagnostics-document-target'
import { getDomainDocumentPresentation } from '@/features/endge-ide/model/domain/domain-document-presentation'

const props = defineProps<{
  entry: ProblemsEntityEntry
}>()

const problems = EndgeIDE.problems
const selected = computed(() => problems.selectedEntityKey.value === props.entry.key)
const presentation = computed(() => {
  const reference = props.entry.entityRef
  if (!reference) {
    return null
  }
  const target = resolveDiagnosticsDocumentTarget(reference)
  return getDomainDocumentPresentation(target?.documentType ?? reference.entityType as DomainDocumentType)
})
const icon = computed<Component>(() => {
  const resolved = getIconComponent(presentation.value?.icon)
  return (resolved as Component | null) ?? (props.entry.runtimeId ? CircleAlert : Box)
})
const iconClass = computed(() => presentation.value?.colorClass ?? 'text-muted-foreground')
const severityCount = computed(() => ({
  fatal: props.entry.problems.filter(problem => problem.severity === 'fatal').length,
  error: props.entry.problems.filter(problem => problem.severity === 'error').length,
  warning: props.entry.problems.filter(problem => problem.severity === 'warning').length,
}))

/** Выбирает сущность и обновляет самостоятельную Problems workspace. */
function selectEntity(): void {
  problems.selectEntity(props.entry.key)
}
</script>

<template>
  <button
    type="button"
    class="group flex min-h-10 w-full min-w-0 items-center gap-2 border-l-2 px-2 py-1.5 text-left text-xs transition-colors"
    :class="selected
      ? 'border-primary bg-primary/10 text-foreground'
      : 'border-transparent text-muted-foreground hover:bg-muted/65 hover:text-foreground'"
    :aria-current="selected ? 'true' : undefined"
    @click="selectEntity"
  >
    <component :is="icon" class="size-3.5 shrink-0" :class="iconClass" stroke-width="1.8" />
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="truncate font-medium text-foreground">{{ entry.title }}</span>
      <span class="truncate text-[10px] leading-3 text-muted-foreground/75">{{ entry.subtitle }}</span>
    </span>
    <span class="flex shrink-0 items-center gap-1 text-[9px] tabular-nums">
      <span v-if="severityCount.fatal" class="rounded bg-rose-700/15 px-1 py-0.5 font-semibold text-rose-600 dark:text-rose-400">
        {{ severityCount.fatal }}F
      </span>
      <span v-if="severityCount.error" class="rounded bg-red-500/10 px-1 py-0.5 font-semibold text-red-600 dark:text-red-400">
        {{ severityCount.error }}E
      </span>
      <span v-if="severityCount.warning" class="rounded bg-amber-500/10 px-1 py-0.5 font-semibold text-amber-600 dark:text-amber-400">
        {{ severityCount.warning }}W
      </span>
      <span v-if="!severityCount.fatal && !severityCount.error && !severityCount.warning" class="rounded bg-sky-500/10 px-1 py-0.5 font-semibold text-sky-600 dark:text-sky-400">
        {{ entry.problems.length }}I
      </span>
    </span>
  </button>
</template>
