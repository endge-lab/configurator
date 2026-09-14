<!--
  Based on Vue Bits DotGrid at commit 090caa2891fc1a26b71e54dfee07b1843d22ddee.
  Copyright (c) 2025 David Haz.

  MIT + Commons Clause License Condition v1.0: permission is granted to use,
  copy, modify, merge, publish and distribute this software as part of an
  application, website or product. The components themselves may not be sold,
  sublicensed or redistributed alone, in a bundle, template or ported version.
  The software is provided without warranty of any kind.
  Source and full license: https://github.com/DavidHDev/vue-bits
-->

<script setup lang="ts">
import type { CSSProperties } from 'vue'

import { gsap } from 'gsap'
import { InertiaPlugin } from 'gsap/InertiaPlugin'
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'

interface Dot {
  cx: number
  cy: number
  xOffset: number
  yOffset: number
  inertiaApplied: boolean
}

interface DotGridProps {
  dotSize?: number
  gap?: number
  baseColor?: string
  activeColor?: string
  proximity?: number
  speedTrigger?: number
  shockRadius?: number
  shockStrength?: number
  maxSpeed?: number
  resistance?: number
  returnDuration?: number
  className?: string
  style?: CSSProperties
}

const props = withDefaults(defineProps<DotGridProps>(), {
  dotSize: 16,
  gap: 32,
  baseColor: '#27ff64',
  activeColor: '#27ff64',
  proximity: 150,
  speedTrigger: 100,
  shockRadius: 250,
  shockStrength: 5,
  maxSpeed: 5000,
  resistance: 750,
  returnDuration: 1.5,
  className: '',
  style: () => ({}),
})

gsap.registerPlugin(InertiaPlugin)

const wrapperRef = useTemplateRef<HTMLDivElement>('wrapperRef')
const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef')
const dots = ref<Dot[]>([])
const pointer = ref({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  speed: 0,
  lastTime: 0,
  lastX: 0,
  lastY: 0,
})

function throttle<T extends unknown[]>(callback: (...args: T) => void, limit: number) {
  let lastCall = 0

  return function (this: unknown, ...args: T) {
    const now = performance.now()
    if (now - lastCall >= limit) {
      lastCall = now
      callback.apply(this, args)
    }
  }
}

function hexToRgb(hex: string) {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (!match) {
    return { r: 0, g: 0, b: 0 }
  }

  return {
    r: Number.parseInt(match[1], 16),
    g: Number.parseInt(match[2], 16),
    b: Number.parseInt(match[3], 16),
  }
}

const baseRgb = computed(() => hexToRgb(props.baseColor))
const activeRgb = computed(() => hexToRgb(props.activeColor))

const circlePath = computed(() => {
  if (typeof window === 'undefined' || !window.Path2D) {
    return null
  }

  const path = new Path2D()
  path.arc(0, 0, props.dotSize / 2, 0, Math.PI * 2)
  return path
})

let animationFrame: number | undefined
let resizeObserver: ResizeObserver | null = null

function buildGrid(): void {
  const wrapper = wrapperRef.value
  const canvas = canvasRef.value
  if (!wrapper || !canvas) {
    return
  }

  const { width, height } = wrapper.getBoundingClientRect()
  const pixelRatio = window.devicePixelRatio || 1

  canvas.width = width * pixelRatio
  canvas.height = height * pixelRatio
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  canvas.getContext('2d')?.scale(pixelRatio, pixelRatio)

  const columns = Math.floor((width + props.gap) / (props.dotSize + props.gap))
  const rows = Math.floor((height + props.gap) / (props.dotSize + props.gap))
  const cell = props.dotSize + props.gap
  const gridWidth = cell * columns - props.gap
  const gridHeight = cell * rows - props.gap
  const startX = (width - gridWidth) / 2 + props.dotSize / 2
  const startY = (height - gridHeight) / 2 + props.dotSize / 2
  const nextDots: Dot[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      nextDots.push({
        cx: startX + column * cell,
        cy: startY + row * cell,
        xOffset: 0,
        yOffset: 0,
        inertiaApplied: false,
      })
    }
  }

  dots.value = nextDots
}

function draw(): void {
  const canvas = canvasRef.value
  const context = canvas?.getContext('2d')
  if (!canvas || !context) {
    return
  }

  context.clearRect(0, 0, canvas.width, canvas.height)
  const proximitySquared = props.proximity * props.proximity

  for (const dot of dots.value) {
    const distanceX = dot.cx - pointer.value.x
    const distanceY = dot.cy - pointer.value.y
    const distanceSquared = distanceX * distanceX + distanceY * distanceY
    let color = props.baseColor

    if (distanceSquared <= proximitySquared) {
      const intensity = 1 - Math.sqrt(distanceSquared) / props.proximity
      const red = Math.round(baseRgb.value.r + (activeRgb.value.r - baseRgb.value.r) * intensity)
      const green = Math.round(baseRgb.value.g + (activeRgb.value.g - baseRgb.value.g) * intensity)
      const blue = Math.round(baseRgb.value.b + (activeRgb.value.b - baseRgb.value.b) * intensity)
      color = `rgb(${red},${green},${blue})`
    }

    if (circlePath.value) {
      context.save()
      context.translate(dot.cx + dot.xOffset, dot.cy + dot.yOffset)
      context.fillStyle = color
      context.fill(circlePath.value)
      context.restore()
    }
  }

  animationFrame = requestAnimationFrame(draw)
}

function returnDot(dot: Dot): void {
  gsap.to(dot, {
    xOffset: 0,
    yOffset: 0,
    duration: props.returnDuration,
    ease: 'elastic.out(1,0.75)',
  })
  dot.inertiaApplied = false
}

function movePointer(event: MouseEvent): void {
  const now = performance.now()
  const deltaTime = pointer.value.lastTime ? now - pointer.value.lastTime : 16
  let velocityX = ((event.clientX - pointer.value.lastX) / deltaTime) * 1000
  let velocityY = ((event.clientY - pointer.value.lastY) / deltaTime) * 1000
  let speed = Math.hypot(velocityX, velocityY)

  if (speed > props.maxSpeed) {
    const scale = props.maxSpeed / speed
    velocityX *= scale
    velocityY *= scale
    speed = props.maxSpeed
  }

  Object.assign(pointer.value, {
    lastTime: now,
    lastX: event.clientX,
    lastY: event.clientY,
    vx: velocityX,
    vy: velocityY,
    speed,
  })

  const canvas = canvasRef.value
  if (!canvas) {
    return
  }

  const bounds = canvas.getBoundingClientRect()
  pointer.value.x = event.clientX - bounds.left
  pointer.value.y = event.clientY - bounds.top

  for (const dot of dots.value) {
    const distance = Math.hypot(dot.cx - pointer.value.x, dot.cy - pointer.value.y)
    if (speed > props.speedTrigger && distance < props.proximity && !dot.inertiaApplied) {
      dot.inertiaApplied = true
      gsap.killTweensOf(dot)
      gsap.to(dot, {
        inertia: {
          xOffset: dot.cx - pointer.value.x + velocityX * 0.005,
          yOffset: dot.cy - pointer.value.y + velocityY * 0.005,
          resistance: props.resistance,
        },
        onComplete: () => returnDot(dot),
      })
    }
  }
}

function shockDots(event: MouseEvent): void {
  const canvas = canvasRef.value
  if (!canvas) {
    return
  }

  const bounds = canvas.getBoundingClientRect()
  const clickX = event.clientX - bounds.left
  const clickY = event.clientY - bounds.top

  for (const dot of dots.value) {
    const distance = Math.hypot(dot.cx - clickX, dot.cy - clickY)
    if (distance < props.shockRadius && !dot.inertiaApplied) {
      dot.inertiaApplied = true
      gsap.killTweensOf(dot)
      const falloff = Math.max(0, 1 - distance / props.shockRadius)
      gsap.to(dot, {
        inertia: {
          xOffset: (dot.cx - clickX) * props.shockStrength * falloff,
          yOffset: (dot.cy - clickY) * props.shockStrength * falloff,
          resistance: props.resistance,
        },
        onComplete: () => returnDot(dot),
      })
    }
  }
}

const throttledMovePointer = throttle(movePointer, 50)

onMounted(async () => {
  await nextTick()
  buildGrid()

  if (circlePath.value) {
    draw()
  }

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(buildGrid)
    if (wrapperRef.value) {
      resizeObserver.observe(wrapperRef.value)
    }
  }
  else {
    window.addEventListener('resize', buildGrid)
  }

  window.addEventListener('mousemove', throttledMovePointer, { passive: true })
  window.addEventListener('click', shockDots)
})

onUnmounted(() => {
  if (animationFrame !== undefined) {
    cancelAnimationFrame(animationFrame)
  }

  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  else {
    window.removeEventListener('resize', buildGrid)
  }

  window.removeEventListener('mousemove', throttledMovePointer)
  window.removeEventListener('click', shockDots)
})

watch([() => props.dotSize, () => props.gap], buildGrid)

watch([() => props.proximity, () => props.baseColor, activeRgb, baseRgb, circlePath], () => {
  if (animationFrame !== undefined) {
    cancelAnimationFrame(animationFrame)
  }
  if (circlePath.value) {
    draw()
  }
})
</script>

<template>
  <section class="vue-bits-dot-grid" :class="props.className" :style="props.style">
    <div ref="wrapperRef" class="vue-bits-dot-grid__wrapper">
      <canvas ref="canvasRef" class="vue-bits-dot-grid__canvas" />
    </div>
  </section>
</template>

<style scoped>
.vue-bits-dot-grid,
.vue-bits-dot-grid__wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.vue-bits-dot-grid__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
