<script setup lang="ts">
import { Raph } from '@endge/raph'
import { SFC_RuntimeRenderer } from '@endge/vue'
import { Braces } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  destroySFCPreviewRuntime,
  sfcPreviewError,
  sfcPreviewInput,
  sfcPreviewRuntime,
  sfcPreviewTitle,
} from '@/features/endge-ide/model/sfc-preview/sfc-preview-state'
import SourceJsonTree from '@/features/endge-ide/ui/components/SourceJsonTree.vue'
import SourceJsonTreeControls from '@/features/endge-ide/ui/components/SourceJsonTreeControls.vue'
import SourceOutputPanel from '@/features/endge-ide/ui/components/SourceOutputPanel.vue'
import { useSafeLocalStorage } from '@/lib/use-safe-local-storage'

interface SourceJsonTreeHandle {
  expandAll: () => void
  collapseAll: () => void
}

const PROPS_PANEL_MIN_WIDTH = 260
const PROPS_PANEL_DEFAULT_WIDTH = 380
const PREVIEW_MIN_WIDTH = 260
const copy = {
  showProps: 'Показать входящие props',
  hideProps: 'Скрыть входящие props',
  stop: 'Остановить',
  empty: 'Запустите демонстрацию SFC-компонента из редактора.',
} as const

const runtime = computed(() => sfcPreviewRuntime.value)
const input = computed(() => sfcPreviewInput.value)
const error = computed(() => sfcPreviewError.value)
const title = computed(() => sfcPreviewTitle.value)
const body = ref<HTMLElement | null>(null)
const propsTree = ref<SourceJsonTreeHandle | null>(null)
const propsRevision = ref(0)
const isResizing = ref(false)
const propsPanelVisible = useSafeLocalStorage('endge:sfc-preview:props-panel-visible', true)
const propsPanelWidth = useSafeLocalStorage('endge:sfc-preview:props-panel-width', PROPS_PANEL_DEFAULT_WIDTH)

let resizeStartX = 0
let resizeStartWidth = PROPS_PANEL_DEFAULT_WIDTH
let disposePropsWatch: VoidFunction | null = null

const resolvedProps = computed<Record<string, unknown>>(() => {
  void propsRevision.value

  const source = runtime.value?.getInputSource() ?? input.value
  if (source.kind === 'local') {
    return { ...source.props }
  }

  const props: Record<string, unknown> = { ...(source.props ?? {}) }
  for (const [key, binding] of Object.entries(source.bindings)) {
    props[key] = Raph.get(binding.path)
  }

  return props
})

function maxPropsPanelWidth(): number {
  const available = body.value?.clientWidth ?? (PROPS_PANEL_DEFAULT_WIDTH + PREVIEW_MIN_WIDTH)
  return Math.max(PROPS_PANEL_MIN_WIDTH, available - PREVIEW_MIN_WIDTH)
}

function clampPropsPanelWidth(width: number): number {
  return Math.min(maxPropsPanelWidth(), Math.max(PROPS_PANEL_MIN_WIDTH, width))
}

function beginResize(event: PointerEvent): void {
  if (event.button !== 0) {
    return
  }

  event.preventDefault()
  resizeStartX = event.clientX
  resizeStartWidth = clampPropsPanelWidth(Number(propsPanelWidth.value))
  isResizing.value = true
  document.body.classList.add('select-none')
  document.body.style.cursor = 'ew-resize'
}

function resizePanel(event: PointerEvent): void {
  if (!isResizing.value) {
    return
  }

  propsPanelWidth.value = clampPropsPanelWidth(resizeStartWidth + resizeStartX - event.clientX)
}

function endResize(): void {
  if (!isResizing.value) {
    return
  }

  isResizing.value = false
  document.body.classList.remove('select-none')
  document.body.style.cursor = ''
}

function resizePanelByKeyboard(event: KeyboardEvent): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
    return
  }

  event.preventDefault()
  const direction = event.key === 'ArrowLeft' ? 1 : -1
  propsPanelWidth.value = clampPropsPanelWidth(Number(propsPanelWidth.value) + direction * 24)
}

function bindPropsWatch(): void {
  disposePropsWatch?.()
  disposePropsWatch = null
  propsRevision.value += 1

  const source = runtime.value?.getInputSource() ?? input.value
  if (source.kind !== 'raph') {
    return
  }

  const paths = Object.values(source.bindings)
    .flatMap(binding => [binding.path, `${binding.path}.*`])

  if (paths.length > 0) {
    disposePropsWatch = Raph.watch(paths, () => {
      propsRevision.value += 1
    })
  }
}

watch([runtime, input], bindPropsWatch, { immediate: true })

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
  <div class="sfc-preview-widget flex h-full min-h-0 flex-col bg-background">
    <div class="flex h-11 shrink-0 items-center gap-2 border-b px-3">
      <div class="min-w-0 flex-1 truncate text-sm font-semibold">
        {{ title }}
      </div>
      <TooltipProvider :delay-duration="200">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="size-8"
              :class="propsPanelVisible ? 'text-sky-500' : 'text-muted-foreground'"
              :aria-pressed="propsPanelVisible"
              aria-label="Показать входящие props"
              @click="propsPanelVisible = !propsPanelVisible"
            >
              <Braces class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ propsPanelVisible ? copy.hideProps : copy.showProps }}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Button
        v-if="runtime"
        type="button"
        variant="outline"
        size="sm"
        @click="destroySFCPreviewRuntime"
      >
        {{ copy.stop }}
      </Button>
    </div>

    <div ref="body" class="sfc-preview-widget__body">
      <main class="sfc-preview-widget__canvas">
        <div v-if="error" class="m-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {{ error }}
        </div>

        <div v-else-if="runtime" class="min-h-0 flex-1 overflow-hidden">
          <SFC_RuntimeRenderer
            :host="runtime"
            :input="input"
          />
        </div>

        <div v-else class="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
          {{ copy.empty }}
        </div>
      </main>

      <template v-if="propsPanelVisible">
        <div
          class="sfc-preview-widget__splitter"
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
          class="sfc-preview-widget__props"
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
  </div>
</template>

<style scoped>
.sfc-preview-widget {
  min-height: 220px;
}

.sfc-preview-widget__body {
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  display: flex;
  overflow: hidden;
}

.sfc-preview-widget__canvas {
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: hsl(var(--background));
}

.sfc-preview-widget__props {
  min-width: 0;
  min-height: 0;
  flex: 0 0 auto;
  overflow: hidden;
}

.sfc-preview-widget__splitter {
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

.sfc-preview-widget__splitter span {
  width: 2px;
  height: 36px;
  border-radius: 999px;
  background: rgb(71 85 105 / 0.8);
  transition: height 140ms ease, background-color 140ms ease;
}

.sfc-preview-widget__splitter:hover span,
.sfc-preview-widget__splitter:focus-visible span,
.sfc-preview-widget__splitter[data-resizing='true'] span {
  height: 52px;
  background: rgb(56 189 248 / 0.9);
}
</style>
