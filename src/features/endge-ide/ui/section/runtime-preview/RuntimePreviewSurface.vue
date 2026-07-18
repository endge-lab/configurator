<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text, style/max-statements-per-line */
import type { RuntimePreviewRenderable, RuntimePreviewTreeNode } from '@/features/endge-ide/domain/types/runtime-preview.types'

import { Raph } from '@endge/raph'
import { EndgeFilterRenderer, SFC_RuntimeRenderer } from '@endge/vue'
import { Boxes, Braces, CircleAlert, LoaderCircle, Pause, Play, RefreshCw, Square, SquareStack } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import SourceJsonTree from '@/features/endge-ide/ui/components/SourceJsonTree.vue'
import SourceJsonTreeControls from '@/features/endge-ide/ui/components/SourceJsonTreeControls.vue'
import SourceOutputPanel from '@/features/endge-ide/ui/components/SourceOutputPanel.vue'
import StoreRuntimePreview from '@/features/endge-ide/ui/section/runtime-preview/StoreRuntimePreview.vue'
import RuntimeLifecycleStatusIcon from '@/features/endge-ide/ui/widgets/components/RuntimeLifecycleStatusIcon.vue'
import { useSafeLocalStorage } from '@/lib/use-safe-local-storage'

interface SourceJsonTreeHandle {
  expandAll: () => void
  collapseAll: () => void
}

type ComponentRenderable = Extract<RuntimePreviewRenderable, { kind: 'component-sfc' }>

const PROPS_PANEL_MIN_WIDTH = 260
const PROPS_PANEL_DEFAULT_WIDTH = 380
const PREVIEW_MIN_WIDTH = 260

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
const componentRenderables = computed<ComponentRenderable[]>(() => renderables.value
  .filter((item): item is ComponentRenderable => item.kind === 'component-sfc'))
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
const body = ref<HTMLElement | null>(null)
const propsTree = ref<SourceJsonTreeHandle | null>(null)
const propsRevision = ref(0)
const isResizing = ref(false)
const propsPanelVisible = useSafeLocalStorage('endge:runtime-preview:props-panel-visible', true)
const propsPanelWidth = useSafeLocalStorage('endge:runtime-preview:props-panel-width', PROPS_PANEL_DEFAULT_WIDTH)
const resolvedProps = computed<Record<string, unknown>>(() => {
  void propsRevision.value
  if (componentRenderables.value.length === 1) {
    return resolveInputProps(componentRenderables.value[0]!)
  }
  return Object.fromEntries(componentRenderables.value.map(item => [item.runtime.entityIdentity, resolveInputProps(item)]))
})

let resizeStartX = 0
let resizeStartWidth = PROPS_PANEL_DEFAULT_WIDTH
let disposePropsWatch: VoidFunction | null = null

function resolveInputProps(item: ComponentRenderable): Record<string, unknown> {
  const source = item.runtime.getInputSource() ?? item.input
  if (source.kind === 'local') {
    return { ...source.props }
  }
  const props: Record<string, unknown> = { ...(source.props ?? {}) }
  for (const [key, binding] of Object.entries(source.bindings)) {
    props[key] = Raph.get(binding.path)
  }
  return props
}

function bindPropsWatch(): void {
  disposePropsWatch?.()
  disposePropsWatch = null
  propsRevision.value += 1
  const paths = componentRenderables.value.flatMap((item) => {
    const source = item.runtime.getInputSource() ?? item.input
    return source.kind === 'raph'
      ? Object.values(source.bindings).flatMap(binding => [binding.path, `${binding.path}.*`])
      : []
  })
  if (paths.length > 0) {
    disposePropsWatch = Raph.watch(paths, () => {
      propsRevision.value += 1
    })
  }
}

function maxPropsPanelWidth(): number {
  const available = body.value?.clientWidth ?? (PROPS_PANEL_DEFAULT_WIDTH + PREVIEW_MIN_WIDTH)
  return Math.max(PROPS_PANEL_MIN_WIDTH, available - PREVIEW_MIN_WIDTH)
}

function clampPropsPanelWidth(width: number): number {
  return Math.min(maxPropsPanelWidth(), Math.max(PROPS_PANEL_MIN_WIDTH, width))
}

function beginResize(event: PointerEvent): void {
  if (event.button !== 0) { return }
  event.preventDefault()
  resizeStartX = event.clientX
  resizeStartWidth = clampPropsPanelWidth(Number(propsPanelWidth.value))
  isResizing.value = true
  document.body.classList.add('select-none')
  document.body.style.cursor = 'ew-resize'
}

function resizePanel(event: PointerEvent): void {
  if (!isResizing.value) { return }
  propsPanelWidth.value = clampPropsPanelWidth(resizeStartWidth + resizeStartX - event.clientX)
}

function endResize(): void {
  if (!isResizing.value) { return }
  isResizing.value = false
  document.body.classList.remove('select-none')
  document.body.style.cursor = ''
}

function resizePanelByKeyboard(event: KeyboardEvent): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') { return }
  event.preventDefault()
  const direction = event.key === 'ArrowLeft' ? 1 : -1
  propsPanelWidth.value = clampPropsPanelWidth(Number(propsPanelWidth.value) + direction * 24)
}

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

watch(componentRenderables, bindPropsWatch, { immediate: true })

onMounted(() => {
  document.addEventListener('pointermove', resizePanel)
  document.addEventListener('pointerup', endResize)
})

onBeforeUnmount(() => {
  disposePropsWatch?.()
  document.removeEventListener('pointermove', resizePanel)
  document.removeEventListener('pointerup', endResize)
  endResize()
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background" data-endge-runtime-preview-surface>
    <header v-if="instance" class="flex min-h-11 shrink-0 items-center justify-end gap-1 border-b px-3">
      <Button
        v-if="componentRenderables.length"
        type="button"
        variant="ghost"
        size="icon"
        :class="propsPanelVisible ? 'text-sky-500' : 'text-muted-foreground'"
        :aria-pressed="propsPanelVisible"
        :title="propsPanelVisible ? 'Скрыть входящие props' : 'Показать входящие props'"
        aria-label="Показать входящие props"
        @click="propsPanelVisible = !propsPanelVisible"
      >
        <Braces class="size-4" />
      </Button>
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

    <div v-else-if="instance" ref="body" class="runtime-preview-surface__body">
      <div class="runtime-preview-surface__canvas">
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

      <template v-if="propsPanelVisible && componentRenderables.length">
        <div
          class="runtime-preview-surface__splitter"
          :data-resizing="isResizing"
          role="separator"
          aria-label="Изменить ширину панели входящих props"
          aria-orientation="vertical"
          :aria-valuenow="Math.round(Number(propsPanelWidth))"
          :aria-valuemin="PROPS_PANEL_MIN_WIDTH"
          :aria-valuemax="Math.round(maxPropsPanelWidth())"
          tabindex="0"
          @pointerdown="beginResize"
          @keydown="resizePanelByKeyboard"
        >
          <span />
        </div>

        <div
          class="runtime-preview-surface__props"
          :style="{
            width: `${clampPropsPanelWidth(Number(propsPanelWidth))}px`,
            maxWidth: `calc(100% - ${PREVIEW_MIN_WIDTH + 7}px)`,
          }"
        >
          <SourceOutputPanel
            :collapsed="false"
            title="props.json"
            collapse-label="Скрыть входящие props"
            expand-label="Показать входящие props"
            mode="docked"
            @update:collapsed="propsPanelVisible = false"
          >
            <template #actions>
              <SourceJsonTreeControls
                :copy-value="resolvedProps"
                copy-label="Скопировать все props"
                copy-success-title="Входящие props скопированы"
                copy-success-description="JSON сохранён в буфер обмена."
                copy-error-title="Не удалось скопировать props"
                @expand-all="propsTree?.expandAll()"
                @collapse-all="propsTree?.collapseAll()"
              />
            </template>

            <template #default>
              <SourceJsonTree
                ref="propsTree"
                :data="resolvedProps"
                root-path="props"
              />
            </template>
          </SourceOutputPanel>
        </div>
      </template>
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
      <Boxes class="size-10 opacity-30" stroke-width="1.25" />
      <div class="max-w-sm text-xs leading-5">
        Runtime Tree пуст. Запустите Project, Composition, Component SFC или Store через Debug Preview.
      </div>
    </div>
  </div>
</template>

<style scoped>
.runtime-preview-surface__body {
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  display: flex;
  overflow: hidden;
}

.runtime-preview-surface__canvas {
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
}

.runtime-preview-surface__props {
  min-width: 0;
  min-height: 0;
  flex: 0 0 auto;
  overflow: hidden;
}

.runtime-preview-surface__splitter {
  position: relative;
  width: 7px;
  min-height: 0;
  flex: 0 0 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-left: 1px solid rgb(51 65 85 / 0.72);
  border-right: 1px solid rgb(51 65 85 / 0.72);
  background: rgb(15 23 42);
  cursor: ew-resize;
  outline: none;
}

.runtime-preview-surface__splitter span {
  width: 2px;
  height: 36px;
  border-radius: 999px;
  background: rgb(71 85 105 / 0.8);
  transition: height 140ms ease, background-color 140ms ease;
}

.runtime-preview-surface__splitter:hover span,
.runtime-preview-surface__splitter:focus-visible span,
.runtime-preview-surface__splitter[data-resizing='true'] span {
  height: 52px;
  background: rgb(56 189 248 / 0.9);
}
</style>
