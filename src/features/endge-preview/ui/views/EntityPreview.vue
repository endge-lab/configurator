<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text, style/max-statements-per-line */
import type { PreviewLifecycleState, PreviewRuntimeTreeNode } from '@/features/endge-preview/domain/types/preview.types'

import { EndgeFilterRenderer, SFC_RuntimeRenderer } from '@endge/vue'
import {
  Boxes,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  Pause,
  Play,
  RefreshCw,
  Square,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { endgePreviewSession } from '@/features/endge-preview/model/core/endge-preview-state'
import { openEndgeDebugPreview } from '@/features/endge-preview/model/navigation/open-debug-preview'
import RuntimeLifecycleStatusIcon from '@/features/endge-preview/ui/components/RuntimeLifecycleStatusIcon.vue'
import StoreRuntimePreview from '@/features/endge-preview/ui/components/StoreRuntimePreview.vue'

withDefaults(defineProps<{
  showExternalLink?: boolean
}>(), {
  showExternalLink: false,
})

const session = endgePreviewSession
const router = useRouter()
const busy = ref(false)
const selected = computed(() => session.selectedNode.value)
const state = computed<PreviewLifecycleState>(() => selected.value ? session.lifecycleState(selected.value) : 'inactive')
const renderables = computed(() => session.renderables.value)
const inactiveRenderables = computed(() => session.inactiveRenderableChildren.value)
const nestedCompositions = computed(() => selected.value ? collectCompositionChildren(selected.value) : [])
const resourceSelected = computed(() => selected.value?.kind === 'resource')
const compositionsTitle = computed(() => selected.value?.kind === 'project' ? 'Project compositions' : 'Вложенные compositions')
const canControl = computed(() => selected.value && selected.value.kind !== 'project' && selected.value.kind !== 'resource')

async function run(operation: () => Promise<void>): Promise<void> {
  if (busy.value) { return }
  busy.value = true
  try { await operation() }
  finally { busy.value = false }
}

function activateNode(node: PreviewRuntimeTreeNode): Promise<void> {
  return run(() => session.select(node.id))
}

function openStandalonePreview(): void {
  const target = session.target.value
  if (target) { openEndgeDebugPreview(router, target.entityType, target.identity) }
}

function collectCompositionChildren(node: PreviewRuntimeTreeNode): PreviewRuntimeTreeNode[] {
  const result: PreviewRuntimeTreeNode[] = []
  const visit = (children: PreviewRuntimeTreeNode[]) => {
    for (const child of children) {
      if (child.kind === 'composition') { result.push(child) }
      else if (child.kind === 'scope') { visit(child.children) }
    }
  }
  visit(node.children)
  return result
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background" data-endge-preview-surface>
    <header class="flex min-h-12 shrink-0 items-center gap-3 border-b px-4">
      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-2">
          <RuntimeLifecycleStatusIcon v-if="selected" :state="state" />
          <h1 class="truncate text-sm font-semibold">
            {{ selected?.title ?? 'Entity Preview' }}
          </h1>
          <span v-if="selected?.activationMode" class="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {{ selected.activationMode }}
          </span>
        </div>
        <div v-if="selected?.subtitle" class="truncate pl-7 text-[10px] text-muted-foreground">
          {{ selected.subtitle }}
        </div>
      </div>

      <div v-if="canControl || (showExternalLink && session.target.value)" class="flex shrink-0 items-center gap-1">
        <Button
          v-if="canControl && state === 'active'"
          variant="ghost"
          size="icon"
          title="Поставить на паузу"
          :disabled="busy"
          @click="run(() => session.pauseSelected())"
        >
          <Pause class="size-4" />
        </Button>
        <Button
          v-else-if="canControl"
          variant="ghost"
          size="icon"
          title="Запустить или продолжить"
          :disabled="busy"
          @click="run(() => session.resumeSelected())"
        >
          <Play class="size-4" />
        </Button>
        <Button
          v-if="canControl"
          variant="ghost"
          size="icon"
          title="Остановить"
          :disabled="busy || state === 'inactive' || state === 'disposed'"
          @click="run(() => session.stopSelected())"
        >
          <Square class="size-4" />
        </Button>
        <Button
          v-if="canControl"
          variant="ghost"
          size="icon"
          title="Перезапустить"
          :disabled="busy"
          @click="run(() => session.restartSelected())"
        >
          <RefreshCw class="size-4" />
        </Button>
        <div v-if="canControl && showExternalLink && session.target.value" class="mx-1 h-5 w-px bg-border" />
        <Button
          v-if="showExternalLink && session.target.value"
          variant="ghost"
          size="icon"
          title="Открыть Debug Preview в отдельной вкладке"
          @click="openStandalonePreview"
        >
          <ExternalLink class="size-4" />
        </Button>
      </div>
    </header>

    <div v-if="session.error.value" class="m-4 flex shrink-0 items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
      <CircleAlert class="mt-0.5 size-4 shrink-0" />
      <span>{{ session.error.value }}</span>
    </div>

    <div v-if="session.status.value === 'preparing'" class="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle class="size-5 animate-spin" />
      Подготавливаем preview runtime…
    </div>

    <div v-else class="min-h-0 flex-1 overflow-auto">
      <div v-if="renderables.length" class="grid gap-5 p-4">
        <section
          v-for="item in renderables"
          :key="item.key"
          class="min-w-0 border-b border-border/70 pb-5 last:border-b-0 last:pb-0"
        >
          <EndgeFilterRenderer
            v-if="item.kind === 'filter-view'"
            :runtime="item.runtime"
          />
          <SFC_RuntimeRenderer
            v-else-if="item.kind === 'component-sfc'"
            :host="item.runtime"
            :input="item.input"
          />
          <StoreRuntimePreview
            v-else-if="item.kind === 'store'"
            :runtime="item.runtime"
          />
          <div v-else class="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
            Runtime <code>{{ item.runtime.entityIdentity }}</code> has renderable capability, but this preview has no specialized renderer yet.
          </div>
        </section>
      </div>

      <div v-if="inactiveRenderables.length" class="border-t p-4">
        <div class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Доступно для запуска
        </div>
        <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <button
            v-for="node in inactiveRenderables"
            :key="node.id"
            type="button"
            class="flex min-w-0 items-center gap-2 rounded-md border border-dashed px-3 py-2 text-left text-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
            @click="activateNode(node)"
          >
            <Play class="size-3.5 shrink-0 text-muted-foreground" />
            <span class="min-w-0 flex-1 truncate">{{ node.title }}</span>
            <span class="text-[10px] text-muted-foreground">manual</span>
          </button>
        </div>
      </div>

      <div v-if="resourceSelected && selected" class="p-4">
        <div class="rounded-md border bg-muted/20 p-4">
          <div class="text-xs font-semibold">
            {{ selected.title }}
          </div>
          <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
            <dt class="text-muted-foreground">
              Resource
            </dt>
            <dd class="font-mono">
              {{ selected.identity }}
            </dd>
            <dt class="text-muted-foreground">
              Type
            </dt>
            <dd>{{ selected.entityType }}</dd>
            <dt class="text-muted-foreground">
              Owner scope
            </dt>
            <dd class="font-mono">
              {{ selected.scopePath }}
            </dd>
          </dl>
          <p class="mt-3 text-[11px] leading-5 text-muted-foreground">
            Resource не имеет независимого lifecycle. Его статус и activation принадлежат owner scope.
          </p>
        </div>
      </div>

      <div v-if="nestedCompositions.length" class="border-t p-4">
        <div class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {{ compositionsTitle }}
        </div>
        <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <button
            v-for="node in nestedCompositions"
            :key="node.id"
            type="button"
            class="flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors hover:bg-muted"
            @click="activateNode(node)"
          >
            <Boxes class="size-3.5 shrink-0 text-primary" />
            <span class="min-w-0 flex-1 truncate">{{ node.title }}</span>
            <RuntimeLifecycleStatusIcon :state="session.lifecycleState(node)" />
          </button>
        </div>
      </div>

      <div
        v-if="!resourceSelected && !renderables.length && !inactiveRenderables.length && !nestedCompositions.length"
        class="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground"
      >
        <Boxes class="size-10 opacity-35" stroke-width="1.25" />
        <div class="max-w-sm text-xs leading-5">
          В выбранном узле нет активных renderable runtime-сущностей. Выберите дочерний узел в дереве или запустите manual runtime.
        </div>
      </div>
    </div>
  </div>
</template>
