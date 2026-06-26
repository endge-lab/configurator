<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, useAttrs, watch } from 'vue'

defineOptions({ inheritAttrs: false })

type Side = 'top' | 'right' | 'bottom' | 'left'
type Align = 'start' | 'center' | 'end'

interface PopoverCtx {
  open: { value: boolean }
  close: () => void
  triggerEl: { value: HTMLElement | null }
}

const attrs = useAttrs()
const popover = inject<PopoverCtx>('popover')
if (!popover)
  throw new Error('PopoverContent must be used inside Popover')

const contentEl = ref<HTMLElement | null>(null)
const style = ref<Record<string, string>>({})

const mergedClass = computed<string>(() => {
  const base = 'z-[9999] pointer-events-auto rounded-lg border bg-background'
  const user = (attrs.class as string | undefined) ?? ''
  return `${base} ${user}`.trim()
})

function updatePosition(): void {
  const t = popover.triggerEl.value
  if (!t)
    return

  const rect = t.getBoundingClientRect()

  const side = String((attrs as any).side ?? 'bottom') as Side
  const align = String((attrs as any).align ?? 'start') as Align
  const gap = Number((attrs as any).sideOffset ?? (attrs as any)['side-offset'] ?? 8)

  const content = contentEl.value
  const cw = content?.offsetWidth ?? 0
  const ch = content?.offsetHeight ?? 0
  const vw = window.innerWidth
  const vh = window.innerHeight
  const avoidCollisions = (attrs as any).avoidCollisions !== false

  let actualSide = side
  if (avoidCollisions) {
    if (side === 'bottom' && rect.bottom + gap + ch > vh && rect.top - gap - ch >= 0)
      actualSide = 'top'
    else if (side === 'top' && rect.top - gap - ch < 0 && rect.bottom + gap + ch <= vh)
      actualSide = 'bottom'
    else if (side === 'right' && rect.right + gap + cw > vw && rect.left - gap - cw >= 0)
      actualSide = 'left'
    else if (side === 'left' && rect.left - gap - cw < 0 && rect.right + gap + cw <= vw)
      actualSide = 'right'
  }

  let top = 0
  let left = 0

  if (actualSide === 'right') {
    left = rect.right + gap
    if (align === 'start')
      top = rect.top
    else if (align === 'center')
      top = rect.top + rect.height / 2 - ch / 2
    else
      top = rect.bottom - ch
  }
  else if (actualSide === 'left') {
    left = rect.left - gap - cw
    if (align === 'start')
      top = rect.top
    else if (align === 'center')
      top = rect.top + rect.height / 2 - ch / 2
    else
      top = rect.bottom - ch
  }
  else if (actualSide === 'top') {
    top = rect.top - gap - ch
    if (align === 'start')
      left = rect.left
    else if (align === 'center')
      left = rect.left + rect.width / 2 - cw / 2
    else
      left = rect.right - cw
  }
  else {
    top = rect.bottom + gap
    if (align === 'start')
      left = rect.left
    else if (align === 'center')
      left = rect.left + rect.width / 2 - cw / 2
    else
      left = rect.right - cw
  }

  if (avoidCollisions) {
    left = Math.max(4, Math.min(vw - cw - 4, left))
    top = Math.max(4, Math.min(vh - ch - 4, top))
  }

  style.value = {
    position: 'fixed',
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
  }
}

async function onOpen(): Promise<void> {
  await nextTick()
  updatePosition()
  requestAnimationFrame(() => {
    updatePosition()
    requestAnimationFrame(() => updatePosition())
  })
}

/**
 * КРИТИЧНО:
 * Закрываем по pointerdown (как раньше), НО определяем "inside" через composedPath().
 * Тогда клик по ссылкам внутри НЕ будет считаться кликом "снаружи",
 * и popover не исчезнет на mousedown.
 */
function onPointerDownOutside(e: PointerEvent): void {
  if (!popover.open.value)
    return

  const path = (e.composedPath?.() ?? []) as EventTarget[]

  const isInsideContent = path.some((n) => {
    const el = n as HTMLElement | null
    return el?.getAttribute?.('data-popover-content') != null
  })

  if (isInsideContent)
    return

  // Не закрывать только если клик по триггеру именно этого поповера (иначе один открытый select не даст закрыть другие)
  const isOnThisTrigger = popover.triggerEl.value && path.some(
    (n) => n === popover.triggerEl.value || (n instanceof Node && popover.triggerEl.value!.contains(n as Node)),
  )
  if (isOnThisTrigger)
    return

  popover.close()
}

function onKeyDown(e: KeyboardEvent): void {
  if (!popover.open.value)
    return
  if (e.key === 'Escape')
    popover.close()
}

watch(
  () => popover.open.value,
  (v) => {
    if (v)
      void onOpen()
  },
)

onMounted(() => {
  // capture=true - ок, потому что composedPath теперь корректно определяет "inside"
  document.addEventListener('pointerdown', onPointerDownOutside, true)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDownOutside, true)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="popover.open.value"
      ref="contentEl"
      data-popover-content
      v-bind="{ ...attrs, class: mergedClass }"
      :style="style"
      @pointerdown.stop
    >
      <slot />
    </div>
  </Teleport>
</template>
