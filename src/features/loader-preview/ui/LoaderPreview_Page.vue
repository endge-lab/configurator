<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, ref } from 'vue'

type LoaderPreviewBackground = 'perspective' | 'dot-grid'

const props = withDefaults(defineProps<{
  background?: LoaderPreviewBackground
}>(), {
  background: 'perspective',
})

const VueBitsDotGrid = defineAsyncComponent(() => import('./VueBitsDotGrid.vue'))

const appVersion: string = __APP_VERSION__
const brandName = 'Endge'
const rootElement = ref<HTMLElement | null>(null)

const nodes = Array.from({ length: 34 }, (_, index) => ({
  '--node-delay': `${(index % 9) * -0.47}s`,
  '--node-duration': `${3.2 + (index % 6) * 0.56}s`,
  '--node-opacity': `${0.22 + (index % 5) * 0.11}`,
  '--node-size': `${index % 7 === 0 ? 4 : index % 3 === 0 ? 3 : 2}px`,
  '--node-x': `${3 + ((index * 37) % 94)}%`,
  '--node-y': `${5 + ((index * 53) % 88)}%`,
}))

let animationFrame: number | undefined
let nextPointerX = 50
let nextPointerY = 48

function renderPointer(): void {
  animationFrame = undefined
  rootElement.value?.style.setProperty('--pointer-x', `${nextPointerX}%`)
  rootElement.value?.style.setProperty('--pointer-y', `${nextPointerY}%`)
}

function trackPointer(event: PointerEvent): void {
  if (event.pointerType === 'touch') {
    return
  }

  const bounds = rootElement.value?.getBoundingClientRect()
  if (!bounds) {
    return
  }

  nextPointerX = ((event.clientX - bounds.left) / bounds.width) * 100
  nextPointerY = ((event.clientY - bounds.top) / bounds.height) * 100

  if (animationFrame === undefined) {
    animationFrame = requestAnimationFrame(renderPointer)
  }
}

function resetPointer(): void {
  nextPointerX = 50
  nextPointerY = 48

  if (animationFrame === undefined) {
    animationFrame = requestAnimationFrame(renderPointer)
  }
}

onBeforeUnmount(() => {
  if (animationFrame !== undefined) {
    cancelAnimationFrame(animationFrame)
  }
})
</script>

<template>
  <main
    ref="rootElement"
    class="loader-preview dark"
    :class="{ 'loader-preview--dot-grid': props.background === 'dot-grid' }"
    @pointerleave="resetPointer"
    @pointermove="trackPointer"
  >
    <div class="loader-preview__backdrop" aria-hidden="true">
      <template v-if="props.background === 'perspective'">
        <div class="loader-preview__aura" />
        <div class="loader-preview__grid loader-preview__grid--back" />
        <div class="loader-preview__grid loader-preview__grid--left" />
        <div class="loader-preview__grid loader-preview__grid--right" />
        <div class="loader-preview__grid loader-preview__grid--floor" />
        <i
          v-for="(node, index) in nodes"
          :key="index"
          class="loader-preview__node"
          :style="node"
        />
        <div class="loader-preview__pointer-light" />
      </template>
      <template v-else>
        <VueBitsDotGrid
          class="loader-preview__dot-grid"
          :dot-size="2"
          :gap="28"
          base-color="#3b3f51"
          active-color="#c792ea"
          :proximity="170"
          :speed-trigger="90"
          :shock-radius="260"
          :shock-strength="4"
          :resistance="780"
          :return-duration="1.4"
        />
        <div class="loader-preview__aura" />
      </template>
      <div class="loader-preview__grain" />
      <div class="loader-preview__vignette" />
    </div>

    <section class="loader-preview__content" aria-labelledby="loader-preview-title">
      <div class="loader-preview__mark-shell">
        <span class="loader-preview__orbit loader-preview__orbit--outer" aria-hidden="true" />
        <span class="loader-preview__orbit loader-preview__orbit--inner" aria-hidden="true" />
        <svg
          class="loader-preview__mark"
          role="img"
          :aria-label="brandName"
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="loader-preview-gradient" x1="26" y1="26" x2="58" y2="38" gradientUnits="userSpaceOnUse">
              <stop stop-color="var(--primary)" />
              <stop offset="1" stop-color="#9d72ea" />
            </linearGradient>
          </defs>
          <path
            fill="#FFFFFF"
            d="M12 6H52C55.3137 6 58 8.68629 58 12V16C58 19.3137 55.3137 22 52 22H22V42H52C55.3137 42 58 44.6863 58 48V52C58 55.3137 55.3137 58 52 58H12C8.68629 58 6 55.3137 6 52V12C6 8.68629 8.68629 6 12 6Z"
          />
          <rect x="26" y="26" width="32" height="12" rx="4" fill="url(#loader-preview-gradient)" />
        </svg>
      </div>

      <h1 id="loader-preview-title" class="loader-preview__title">
        {{ brandName }}
      </h1>
      <p class="loader-preview__version">
        {{ $t('uiText.text2da600bf') }} {{ appVersion }}
      </p>

      <div class="loader-preview__status" role="status" aria-live="polite">
        <span class="loader-preview__status-dot" aria-hidden="true" />
        <span>{{ $t('loaderPreview.loadingWorkspace') }}</span>
      </div>

      <div class="loader-preview__progress" aria-hidden="true">
        <span />
      </div>
    </section>
  </main>
</template>

<style scoped>
.loader-preview {
  --pointer-x: 50%;
  --pointer-y: 48%;
  position: relative;
  isolation: isolate;
  display: grid;
  min-height: 100vh;
  min-height: 100svh;
  place-items: center;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 44%, rgba(30, 38, 77, 0.64), transparent 34%),
    linear-gradient(180deg, #0a0e1b 0%, #060913 58%, #080b15 100%);
  color: #f7f8ff;
  font-family: "Avenir Next", "Segoe UI Variable", "Helvetica Neue", sans-serif;
  cursor: default;
  user-select: none;
}

.loader-preview__backdrop,
.loader-preview__aura,
.loader-preview__grain,
.loader-preview__grid,
.loader-preview__pointer-light,
.loader-preview__vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.loader-preview__backdrop {
  z-index: -1;
  overflow: hidden;
}

.loader-preview__backdrop::before,
.loader-preview__backdrop::after {
  position: absolute;
  content: "";
  pointer-events: none;
}

.loader-preview__aura {
  background:
    radial-gradient(circle at 50% 48%, color-mix(in srgb, var(--primary) 13%, transparent), transparent 19%),
    radial-gradient(ellipse 54% 42% at 50% 49%, color-mix(in srgb, var(--primary) 7%, transparent), transparent 72%);
  animation: loader-aura 5s ease-in-out infinite;
}

.loader-preview__grid {
  background-image:
    linear-gradient(color-mix(in srgb, var(--primary) 14%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--primary) 12%, transparent) 1px, transparent 1px);
  background-size: 56px 56px;
}

.loader-preview__grid--back {
  inset: -8%;
  opacity: 0.32;
  mask-image: radial-gradient(ellipse 72% 68% at 50% 48%, transparent 13%, #000 55%, transparent 100%);
}

.loader-preview__grid--left,
.loader-preview__grid--right {
  top: -14%;
  bottom: -14%;
  width: 49%;
  opacity: 0.5;
  background-size: 45px 45px;
  mask-image: linear-gradient(to right, #000 0%, rgba(0, 0, 0, 0.52) 58%, transparent 100%);
}

.loader-preview__grid--left {
  right: auto;
  transform: perspective(760px) rotateY(54deg) translateX(-18%);
  transform-origin: left center;
}

.loader-preview__grid--right {
  left: auto;
  transform: perspective(760px) rotateY(-54deg) translateX(18%);
  transform-origin: right center;
  mask-image: linear-gradient(to left, #000 0%, rgba(0, 0, 0, 0.52) 58%, transparent 100%);
}

.loader-preview__grid--floor {
  top: 54%;
  right: -35%;
  bottom: -47%;
  left: -35%;
  opacity: 0.68;
  background-size: 62px 62px;
  transform: perspective(500px) rotateX(63deg) scale(1.22);
  transform-origin: center top;
  mask-image: linear-gradient(to bottom, transparent 0%, #000 27%, rgba(0, 0, 0, 0.76) 76%, transparent 100%);
  animation: loader-grid-drift 9s linear infinite;
}

.loader-preview__node {
  position: absolute;
  top: var(--node-y);
  left: var(--node-x);
  width: var(--node-size);
  height: var(--node-size);
  border-radius: 999px;
  background: var(--primary);
  box-shadow: 0 0 9px color-mix(in srgb, var(--primary) 82%, transparent);
  opacity: var(--node-opacity);
  animation: loader-node var(--node-duration) ease-in-out var(--node-delay) infinite;
}

.loader-preview__pointer-light {
  background:
    radial-gradient(circle 220px at var(--pointer-x) var(--pointer-y), color-mix(in srgb, var(--primary) 15%, transparent), transparent 72%);
  mix-blend-mode: screen;
  transition: opacity 180ms ease;
}

.loader-preview__grain {
  opacity: 0.055;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.86' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.58'/%3E%3C/svg%3E");
  mix-blend-mode: soft-light;
}

.loader-preview__vignette {
  box-shadow: inset 0 0 190px 55px rgba(0, 0, 0, 0.72);
}

.loader-preview--dot-grid {
  background:
    radial-gradient(circle at 50% 46%, rgba(30, 38, 77, 0.54), transparent 35%),
    linear-gradient(180deg, #0a0e1b 0%, #060913 58%, #080b15 100%);
}

.loader-preview--dot-grid .loader-preview__aura {
  background: radial-gradient(circle at 50% 48%, color-mix(in srgb, var(--primary) 11%, transparent), transparent 25%);
}

.loader-preview__dot-grid {
  position: absolute;
  inset: 0;
  opacity: 0.72;
  mask-image: radial-gradient(ellipse 88% 86% at 50% 50%, #000 0%, rgba(0, 0, 0, 0.76) 68%, transparent 100%);
}

.loader-preview__content {
  display: flex;
  width: min(88vw, 460px);
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  text-align: center;
  animation: loader-content-enter 900ms cubic-bezier(0.2, 0.78, 0.24, 1) both;
}

.loader-preview__mark-shell {
  position: relative;
  display: grid;
  width: 154px;
  height: 154px;
  margin-bottom: 22px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--primary) 12%, transparent);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(69, 72, 122, 0.19), rgba(7, 10, 21, 0.42) 66%, transparent 68%);
  box-shadow:
    0 0 50px color-mix(in srgb, var(--primary) 11%, transparent),
    inset 0 0 40px color-mix(in srgb, var(--primary) 6%, transparent);
}

.loader-preview__mark {
  width: auto;
  height: 96px;
  filter: drop-shadow(0 10px 26px rgba(0, 0, 0, 0.42));
  animation: loader-mark 2.6s ease-in-out infinite;
}

.loader-preview__orbit {
  position: absolute;
  border-radius: 50%;
}

.loader-preview__orbit--outer {
  inset: -1px;
  border-top: 1px solid color-mix(in srgb, var(--primary) 70%, transparent);
  border-right: 1px solid transparent;
  animation: loader-orbit 8s linear infinite;
}

.loader-preview__orbit--inner {
  inset: 13px;
  border-bottom: 1px solid color-mix(in srgb, var(--primary) 38%, transparent);
  border-left: 1px solid transparent;
  animation: loader-orbit 6s linear infinite reverse;
}

.loader-preview__title {
  margin: 0;
  color: #fbfbff;
  font-size: clamp(42px, 5vw, 58px);
  font-weight: 450;
  letter-spacing: -0.045em;
  line-height: 0.98;
  text-shadow: 0 10px 40px rgba(0, 0, 0, 0.48);
}

.loader-preview__version {
  margin: 13px 0 0;
  color: rgba(188, 194, 221, 0.62);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.loader-preview__status {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 41px;
  color: rgba(219, 223, 243, 0.72);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.025em;
}

.loader-preview__status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 0 12px color-mix(in srgb, var(--primary) 90%, transparent);
  animation: loader-status 1.55s ease-in-out infinite;
}

.loader-preview__progress {
  position: relative;
  width: 150px;
  height: 1px;
  margin-top: 16px;
  overflow: hidden;
  background: rgba(132, 143, 196, 0.12);
}

.loader-preview__progress span {
  position: absolute;
  inset: 0 auto 0 -45%;
  width: 45%;
  background: linear-gradient(90deg, transparent, var(--primary) 48%, #9d72ea 72%, transparent);
  filter: drop-shadow(0 0 5px color-mix(in srgb, var(--primary) 72%, transparent));
  animation: loader-progress 1.8s ease-in-out infinite;
}

@keyframes loader-aura {
  0%, 100% { opacity: 0.72; transform: scale(0.96); }
  50% { opacity: 1; transform: scale(1.04); }
}

@keyframes loader-grid-drift {
  to { background-position: 0 62px, 62px 0; }
}

@keyframes loader-node {
  0%, 100% { opacity: 0.12; transform: scale(0.7); }
  50% { opacity: var(--node-opacity); transform: scale(1.18); }
}

@keyframes loader-content-enter {
  from { opacity: 0; transform: translateY(13px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes loader-mark {
  0%, 100% { opacity: 0.88; transform: scale(0.985); }
  50% { opacity: 1; transform: scale(1); }
}

@keyframes loader-orbit {
  to { transform: rotate(360deg); }
}

@keyframes loader-status {
  0%, 100% { opacity: 0.38; transform: scale(0.82); }
  50% { opacity: 1; transform: scale(1.2); }
}

@keyframes loader-progress {
  0% { left: -45%; }
  65%, 100% { left: 100%; }
}

@media (max-width: 640px) {
  .loader-preview__grid--left,
  .loader-preview__grid--right {
    opacity: 0.28;
  }

  .loader-preview__grid--floor {
    top: 58%;
  }

  .loader-preview__mark-shell {
    width: 136px;
    height: 136px;
  }

  .loader-preview__mark {
    width: auto;
    height: 82px !important;
  }

}

@media (prefers-reduced-motion: reduce) {
  .loader-preview *,
  .loader-preview *::before,
  .loader-preview *::after {
    scroll-behavior: auto !important;
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
  }

  .loader-preview__pointer-light {
    display: none;
  }
}
</style>
