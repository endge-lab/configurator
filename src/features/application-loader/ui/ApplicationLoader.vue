<script setup lang="ts">
import VueBitsDotGrid from './VueBitsDotGrid.vue'

defineProps<{
  statusLabel: string
  versionLabel: string
}>()

const appVersion: string = __APP_VERSION__
const brandName = 'Endge'
</script>

<template>
  <main class="application-loader dark">
    <div class="application-loader__backdrop" aria-hidden="true">
      <VueBitsDotGrid
        class="application-loader__dot-grid"
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
      <div class="application-loader__aura" />
      <div class="application-loader__grain" />
      <div class="application-loader__vignette" />
    </div>

    <section class="application-loader__content" aria-labelledby="application-loader-title">
      <div class="application-loader__mark-shell">
        <span class="application-loader__orbit application-loader__orbit--outer" aria-hidden="true" />
        <span class="application-loader__orbit application-loader__orbit--inner" aria-hidden="true" />
        <svg
          class="application-loader__mark"
          role="img"
          :aria-label="brandName"
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="application-loader-gradient" x1="26" y1="26" x2="58" y2="38" gradientUnits="userSpaceOnUse">
              <stop stop-color="var(--primary)" />
              <stop offset="1" stop-color="#9d72ea" />
            </linearGradient>
          </defs>
          <path
            fill="#FFFFFF"
            d="M12 6H52C55.3137 6 58 8.68629 58 12V16C58 19.3137 55.3137 22 52 22H22V42H52C55.3137 42 58 44.6863 58 48V52C58 55.3137 55.3137 58 52 58H12C8.68629 58 6 55.3137 6 52V12C6 8.68629 8.68629 6 12 6Z"
          />
          <rect x="26" y="26" width="32" height="12" rx="4" fill="url(#application-loader-gradient)" />
        </svg>
      </div>

      <h1 id="application-loader-title" class="application-loader__title">
        {{ brandName }}
      </h1>
      <p class="application-loader__version">
        {{ versionLabel }} {{ appVersion }}
      </p>

      <div class="application-loader__status" role="status" aria-live="polite">
        <span class="application-loader__status-dot" aria-hidden="true" />
        <span>{{ statusLabel }}</span>
      </div>

      <div class="application-loader__progress" aria-hidden="true">
        <span />
      </div>
    </section>
  </main>
</template>

<style scoped>
.application-loader {
  position: relative;
  isolation: isolate;
  display: grid;
  min-height: 100vh;
  min-height: 100svh;
  place-items: center;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 46%, rgba(30, 38, 77, 0.54), transparent 35%),
    linear-gradient(180deg, #0a0e1b 0%, #060913 58%, #080b15 100%);
  color: #f7f8ff;
  font-family: "Avenir Next", "Segoe UI Variable", "Helvetica Neue", sans-serif;
  cursor: default;
  user-select: none;
}

.application-loader__backdrop,
.application-loader__aura,
.application-loader__grain,
.application-loader__vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.application-loader__backdrop {
  z-index: -1;
  overflow: hidden;
}

.application-loader__aura {
  background: radial-gradient(circle at 50% 48%, color-mix(in srgb, var(--primary) 11%, transparent), transparent 25%);
  animation: application-loader-aura 5s ease-in-out infinite;
}

.application-loader__dot-grid {
  position: absolute;
  inset: 0;
  opacity: 0.72;
  mask-image: radial-gradient(ellipse 88% 86% at 50% 50%, #000 0%, rgba(0, 0, 0, 0.76) 68%, transparent 100%);
}

.application-loader__grain {
  opacity: 0.055;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.86' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.58'/%3E%3C/svg%3E");
  mix-blend-mode: soft-light;
}

.application-loader__vignette {
  box-shadow: inset 0 0 190px 55px rgba(0, 0, 0, 0.72);
}

.application-loader__content {
  display: flex;
  width: min(88vw, 460px);
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  text-align: center;
  animation: application-loader-content-enter 900ms cubic-bezier(0.2, 0.78, 0.24, 1) both;
}

.application-loader__mark-shell {
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

.application-loader__mark {
  width: auto;
  height: 96px;
  filter: drop-shadow(0 10px 26px rgba(0, 0, 0, 0.42));
  animation: application-loader-mark 2.6s ease-in-out infinite;
}

.application-loader__orbit {
  position: absolute;
  border-radius: 50%;
}

.application-loader__orbit--outer {
  inset: -1px;
  border-top: 1px solid color-mix(in srgb, var(--primary) 70%, transparent);
  border-right: 1px solid transparent;
  animation: application-loader-orbit 8s linear infinite;
}

.application-loader__orbit--inner {
  inset: 13px;
  border-bottom: 1px solid color-mix(in srgb, var(--primary) 38%, transparent);
  border-left: 1px solid transparent;
  animation: application-loader-orbit 6s linear infinite reverse;
}

.application-loader__title {
  margin: 0;
  color: #fbfbff;
  font-size: clamp(42px, 5vw, 58px);
  font-weight: 450;
  letter-spacing: -0.045em;
  line-height: 0.98;
  text-shadow: 0 10px 40px rgba(0, 0, 0, 0.48);
}

.application-loader__version {
  margin: 13px 0 0;
  color: rgba(188, 194, 221, 0.62);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.application-loader__status {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 41px;
  color: rgba(219, 223, 243, 0.72);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.025em;
}

.application-loader__status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 0 12px color-mix(in srgb, var(--primary) 90%, transparent);
  animation: application-loader-status 1.55s ease-in-out infinite;
}

.application-loader__progress {
  position: relative;
  width: 150px;
  height: 1px;
  margin-top: 16px;
  overflow: hidden;
  background: rgba(132, 143, 196, 0.12);
}

.application-loader__progress span {
  position: absolute;
  inset: 0 auto 0 -45%;
  width: 45%;
  background: linear-gradient(90deg, transparent, var(--primary) 48%, #9d72ea 72%, transparent);
  filter: drop-shadow(0 0 5px color-mix(in srgb, var(--primary) 72%, transparent));
  animation: application-loader-progress 1.8s ease-in-out infinite;
}

@keyframes application-loader-aura {
  0%, 100% { opacity: 0.72; transform: scale(0.96); }
  50% { opacity: 1; transform: scale(1.04); }
}

@keyframes application-loader-content-enter {
  from { opacity: 0; transform: translateY(13px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes application-loader-mark {
  0%, 100% { opacity: 0.88; transform: scale(0.985); }
  50% { opacity: 1; transform: scale(1); }
}

@keyframes application-loader-orbit {
  to { transform: rotate(360deg); }
}

@keyframes application-loader-status {
  0%, 100% { opacity: 0.38; transform: scale(0.82); }
  50% { opacity: 1; transform: scale(1.2); }
}

@keyframes application-loader-progress {
  0% { left: -45%; }
  65%, 100% { left: 100%; }
}

@media (max-width: 640px) {
  .application-loader__mark-shell {
    width: 136px;
    height: 136px;
  }

  .application-loader__mark {
    height: 82px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .application-loader *,
  .application-loader *::before,
  .application-loader *::after {
    scroll-behavior: auto !important;
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
