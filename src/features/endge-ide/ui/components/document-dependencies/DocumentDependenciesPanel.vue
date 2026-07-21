<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type {
  DocumentDependencyNode,
  DocumentDependencyTreeResult,
} from '@/features/endge-ide/model/document-dependencies/document-dependency-types'
import type { DomainDocumentType } from '@endge/core'

import { Endge } from '@endge/core'
import { GitFork, Network, TriangleAlert } from 'lucide-vue-next'
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSmartTabViewState } from '@/components/ui/smart-tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  buildCompositionDependencyHierarchy,
  buildCompositionDependencyTree,
} from '@/features/endge-ide/model/composition-dependencies/composition-dependency-tree'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import {
  buildDocumentDependencyHierarchy,
  buildDocumentDependencyTree,
} from '@/features/endge-ide/model/document-dependencies/document-dependency-graph'
import { countDocumentDependencies } from '@/features/endge-ide/model/document-dependencies/document-dependency-types'
import DocumentDependencyTreeNode from '@/features/endge-ide/ui/components/document-dependencies/DocumentDependencyTreeNode.vue'

const props = defineProps<{
  documentType: DomainDocumentType
  id?: string | number | null
  identity: string
  displayName?: string | null
  source?: string | null
  draft?: unknown
}>()

const fullHierarchyVisible = useSmartTabViewState<boolean>(
  'document.dependencies.full-hierarchy',
  {
    defaultValue: () => false,
    validate: value => typeof value === 'boolean',
  },
)
const result = shallowRef<DocumentDependencyTreeResult>(buildTree())
const dependencyCount = computed(() => countDocumentDependencies(result.value.root))
const errorCount = computed(
  () => result.value.diagnostics.filter(item => item.severity === 'error').length,
)
let refreshTimer: ReturnType<typeof setTimeout> | null = null
const unsubscribeDomain = Endge.domain.subscribe(() => scheduleRefresh())
const unsubscribeProgram = Endge.program.subscribe(() => scheduleRefresh())

watch(
  () => [props.documentType, props.id, props.identity, props.displayName, props.source, props.draft],
  () => scheduleRefresh(),
  { deep: true },
)

onBeforeUnmount(() => {
  unsubscribeDomain()
  unsubscribeProgram()
  if (refreshTimer) {
    clearTimeout(refreshTimer)
  }
})

function buildTree(): DocumentDependencyTreeResult {
  if (String(props.documentType) === 'composition') {
    const input = {
      identity: props.identity,
      displayName: props.displayName,
      source: props.source ?? '',
    }
    return fullHierarchyVisible.value
      ? buildCompositionDependencyHierarchy(input)
      : buildCompositionDependencyTree(input)
  }

  const input = {
    documentType: props.documentType,
    id: props.id,
    identity: props.identity,
    displayName: props.displayName,
    source: props.source,
    draft: props.draft,
  }
  return fullHierarchyVisible.value
    ? buildDocumentDependencyHierarchy(input)
    : buildDocumentDependencyTree(input)
}

function scheduleRefresh(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
  }
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    result.value = buildTree()
  }, 140)
}

function toggleFullHierarchy(): void {
  fullHierarchyVisible.value = !fullHierarchyVisible.value
  result.value = buildTree()
}

function openDocument(node: DocumentDependencyNode): void {
  if (!node.documentType || node.status === 'missing') {
    return
  }
  EndgeIDE.tabs.openDocument(node.identity, node.documentType)
}
</script>

<template>
  <section
    class="flex h-full min-h-0 flex-col border-l border-border/55 bg-background"
    aria-label="Зависимости документа"
  >
    <header class="flex h-10 shrink-0 items-center gap-2 border-b border-border/65 px-3">
      <GitFork class="size-3.5 text-sky-400" stroke-width="1.8" />
      <span class="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Зависимости
      </span>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="ml-auto h-6 w-6"
              :class="
                fullHierarchyVisible
                  ? 'bg-fuchsia-400/10 text-fuchsia-300 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              "
              :aria-pressed="fullHierarchyVisible"
              :aria-label="
                fullHierarchyVisible
                  ? 'Показать только зависимости документа'
                  : 'Показать использования и зависимости документа'
              "
              @click="toggleFullHierarchy"
            >
              <Network class="size-3.5" stroke-width="1.8" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {{
              fullHierarchyVisible
                ? "Показать только зависимости"
                : "Показать, где используется документ, и его зависимости"
            }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <span
        v-if="result.root"
        class="rounded-sm border border-border/70 bg-muted/35 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
      >
        {{ dependencyCount }}
      </span>
    </header>

    <div
      v-if="result.status === 'compile-error' && !result.root"
      class="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center"
    >
      <span class="inline-flex size-9 items-center justify-center rounded-full border border-amber-400/25 bg-amber-400/5 text-amber-400">
        <TriangleAlert class="size-4" stroke-width="1.8" />
      </span>
      <span class="text-xs font-medium text-foreground">Ошибки компиляции</span>
      <span class="text-[10px] text-muted-foreground">
        {{ errorCount }} {{ errorCount === 1 ? "ошибка" : "ошибок" }} в текущем source
      </span>
    </div>

    <ScrollArea v-else class="min-h-0 flex-1">
      <div class="py-1.5">
        <div
          v-if="result.status === 'compile-error'"
          class="mx-3 mb-1.5 flex items-center gap-2 border-l-2 border-amber-400/60 bg-amber-400/[0.04] px-2 py-1.5 text-[10px] text-amber-300"
        >
          <TriangleAlert class="size-3.5 shrink-0" />
          Ошибки компиляции: {{ errorCount }}
        </div>
        <DocumentDependencyTreeNode
          v-if="result.root"
          :node="result.root"
          :depth="0"
          root
          @open="openDocument"
        />
        <div
          v-if="result.root && !result.root.children.length"
          class="mx-3 my-3 border-l border-dashed border-border pl-3 text-[11px] text-muted-foreground"
        >
          Внешних зависимостей нет
        </div>
      </div>
    </ScrollArea>
  </section>
</template>
