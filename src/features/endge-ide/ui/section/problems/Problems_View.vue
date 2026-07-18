<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { DomainDocumentType } from '@endge/core'
import type { Component } from 'vue'

import { Bug, CircleCheck, ExternalLink, ShieldAlert } from 'lucide-vue-next'
import { computed } from 'vue'

import { showWidget } from '@/components/layouts/grid'
import { getIconComponent } from '@/components/layouts/grid/icons'
import { Button } from '@/components/ui/button'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import { resolveDiagnosticsDocumentTarget } from '@/features/endge-ide/model/diagnostics/diagnostics-document-target'
import { getDomainDocumentPresentation } from '@/features/endge-ide/model/domain/domain-document-presentation'
import EntityProblemsPanel from '@/features/endge-ide/ui/components/diagnostics/EntityProblemsPanel.vue'

const problems = EndgeIDE.problems
const selectedEntry = computed(() => problems.selectedEntry.value)
const entityPresentation = computed(() => {
  const reference = selectedEntry.value?.entityRef
  if (!reference) {
    return null
  }
  const target = resolveDiagnosticsDocumentTarget(reference)
  return getDomainDocumentPresentation(target?.documentType ?? reference.entityType as DomainDocumentType)
})
const entityIcon = computed<Component>(() => {
  return getIconComponent(entityPresentation.value?.icon) as Component | null ?? Bug
})
const entityIconClass = computed(() => entityPresentation.value?.colorClass ?? 'text-muted-foreground')

/** Открывает persisted entity в Project workspace. */
function openSelectedEntity(): void {
  const ref = selectedEntry.value?.entityRef
  if (!ref) {
    return
  }
  if (EndgeIDE.tabs.openDiagnosticsEntity(ref)) {
    showWidget('project')
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background" data-endge-problems-workspace>
    <template v-if="selectedEntry">
      <header class="flex min-h-12 shrink-0 items-center gap-3 border-b px-4">
        <span class="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/40">
          <component :is="entityIcon" class="size-4" :class="entityIconClass" stroke-width="1.8" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold">
            {{ selectedEntry.title }}
          </div>
          <div class="truncate text-[10px] text-muted-foreground">
            {{ selectedEntry.subtitle }} · {{ selectedEntry.problems.length }} problems
          </div>
        </div>
        <Button
          v-if="selectedEntry.entityRef"
          type="button"
          variant="outline"
          size="sm"
          class="h-8 gap-1.5 text-xs"
          @click="openSelectedEntity"
        >
          <ExternalLink class="size-3.5" />
          Открыть сущность
        </Button>
      </header>

      <EntityProblemsPanel :problems="selectedEntry.problems" class="min-h-0 flex-1" />
    </template>

    <div v-else class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
      <span class="relative">
        <ShieldAlert class="size-12 opacity-20" stroke-width="1.2" />
        <CircleCheck class="absolute -bottom-1 -right-1 size-5 text-emerald-500" />
      </span>
      <div class="text-sm font-medium text-foreground">
        Актуальных problems нет
      </div>
      <div class="max-w-sm text-xs leading-5">
        Выберите повторный анализ в левом дереве после изменения исходников.
      </div>
    </div>
  </div>
</template>
