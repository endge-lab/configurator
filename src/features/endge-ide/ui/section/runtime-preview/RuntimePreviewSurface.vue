<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text, style/max-statements-per-line */
import type { RuntimePreviewTreeNode } from '@/features/endge-ide/domain/types/runtime-preview.types'

import { EndgeFilterRenderer, SFC_RuntimeRenderer } from '@endge/vue'
import { Boxes, CircleAlert, LoaderCircle, Pause, Play, RefreshCw, Square, SquareStack } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import StoreRuntimePreview from '@/features/endge-ide/ui/section/runtime-preview/StoreRuntimePreview.vue'
import RuntimeLifecycleStatusIcon from '@/features/endge-ide/ui/widgets/components/RuntimeLifecycleStatusIcon.vue'

const preview = EndgeIDE.runtimePreview
const busy = ref(false)
const instance = computed(() => preview.selectedEntry.value)
const selected = computed(() => preview.selectedNode.value)
const state = computed(() => {
  const entry = instance.value
  const node = selected.value
  return entry && node ? entry.lifecycleState(node) : 'inactive'
})
const renderables = computed(() => instance.value?.renderables.value ?? [])
const inactiveRenderables = computed(() => instance.value?.inactiveRenderableChildren.value ?? [])
const nestedCompositions = computed(() => selected.value ? collectCompositionChildren(selected.value) : [])
const resourceSelected = computed(() => selected.value?.kind === 'resource')
const canControl = computed(() => {
  const entry = instance.value
  const node = selected.value
  if (!entry || !node || node.kind === 'resource') { return false }
  if (node.parentId == null) { return true }
  return entry.status.value !== 'stopped'
    && entry.status.value !== 'error'
    && entry.status.value !== 'preparing'
    && entry.status.value !== 'disposed'
})

async function run(operation: () => Promise<void>): Promise<void> {
  if (busy.value) { return }
  busy.value = true
  try { await operation() }
  catch (error) {
    toast.error('Не удалось изменить состояние Runtime', {
      description: error instanceof Error ? error.message : String(error),
    })
  }
  finally { busy.value = false }
}

function activateNode(node: RuntimePreviewTreeNode): Promise<void> {
  const entry = instance.value
  return entry ? run(() => preview.select(entry.key, node.id)) : Promise.resolve()
}

function collectCompositionChildren(node: RuntimePreviewTreeNode): RuntimePreviewTreeNode[] {
  const result: RuntimePreviewTreeNode[] = []
  const visit = (children: RuntimePreviewTreeNode[]) => {
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
  <div class="flex h-full min-h-0 flex-col bg-background" data-endge-runtime-preview-surface>
    <header v-if="instance" class="flex min-h-11 shrink-0 items-center justify-end gap-1 border-b px-3">
      <Button
        v-if="canControl && state === 'active'"
        variant="ghost"
        size="icon"
        title="Поставить на паузу"
        :disabled="busy"
        @click="run(() => preview.pauseSelected())"
      >
        <Pause class="size-4" />
      </Button>
      <Button
        v-else-if="canControl && state === 'paused'"
        variant="ghost"
        size="icon"
        title="Продолжить"
        :disabled="busy"
        @click="run(() => preview.resumeSelected())"
      >
        <Play class="size-4" />
      </Button>
      <Button
        v-if="canControl"
        variant="ghost"
        size="icon"
        title="Остановить"
        :disabled="busy || state === 'stopped' || state === 'disposed' || state === 'inactive'"
        @click="run(() => preview.stopSelected())"
      >
        <Square class="size-4" />
      </Button>
      <Button
        v-if="canControl"
        variant="ghost"
        size="icon"
        title="Перезапустить"
        :disabled="busy"
        @click="run(() => preview.restartSelected())"
      >
        <RefreshCw class="size-4" />
      </Button>
      <div class="mx-1 h-5 w-px bg-border" />
      <Button
        variant="ghost"
        size="icon"
        title="Остановить все runtime instances"
        :disabled="busy || !preview.entries.value.length"
        @click="run(() => preview.stopAll())"
      >
        <SquareStack class="size-4" />
      </Button>
    </header>

    <div v-if="instance?.error.value" class="m-4 flex shrink-0 items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
      <CircleAlert class="mt-0.5 size-4 shrink-0" />
      <span>{{ instance.error.value }}</span>
    </div>

    <div v-if="instance?.status.value === 'preparing'" class="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle class="size-5 animate-spin" />
      Подготавливаем preview runtime…
    </div>

    <div v-else-if="instance" class="min-h-0 flex-1 overflow-auto">
      <div v-if="renderables.length" class="grid gap-5 p-4">
        <section
          v-for="item in renderables"
          :key="item.key"
          class="min-w-0 border-b border-border/70 pb-5 last:border-b-0 last:pb-0"
        >
          <EndgeFilterRenderer v-if="item.kind === 'filter-view'" :runtime="item.runtime" />
          <SFC_RuntimeRenderer
            v-else-if="item.kind === 'component-sfc'"
            :host="item.runtime"
            :input="item.input"
          />
          <StoreRuntimePreview v-else-if="item.kind === 'store'" :runtime="item.runtime" />
          <div v-else class="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
            Runtime <code>{{ item.runtime.entityIdentity }}</code> имеет renderable capability, но пока не имеет отдельного preview renderer.
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
            Resource не имеет независимого lifecycle. Его состояние принадлежит owner scope.
          </p>
        </div>
      </div>

      <div v-if="nestedCompositions.length" class="border-t p-4">
        <div class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {{ selected?.kind === 'project' ? 'Project compositions' : 'Вложенные compositions' }}
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
            <RuntimeLifecycleStatusIcon :state="instance.lifecycleState(node)" />
          </button>
        </div>
      </div>

      <div
        v-if="!resourceSelected && !renderables.length && !inactiveRenderables.length && !nestedCompositions.length"
        class="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground"
      >
        <Boxes class="size-10 opacity-35" stroke-width="1.25" />
        <div class="max-w-sm text-xs leading-5">
          В выбранном узле нет активных renderable runtime-сущностей. Выберите дочерний узел или запустите manual runtime.
        </div>
      </div>
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
      <Boxes class="size-10 opacity-30" stroke-width="1.25" />
      <div class="max-w-sm text-xs leading-5">
        Runtime Tree пуст. Запустите Project, Composition, Component SFC или Store через Debug Preview.
      </div>
    </div>
  </div>
</template>
