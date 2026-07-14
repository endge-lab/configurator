<script setup lang="ts">
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, FileJson } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'

withDefaults(defineProps<{
  title: string
  collapsed: boolean
  collapseLabel: string
  expandLabel: string
  mode?: 'popover' | 'full-height'
}>(), {
  mode: 'popover',
})

const emit = defineEmits<{
  (event: 'update:collapsed', value: boolean): void
}>()
</script>

<template>
  <Button
    v-if="collapsed"
    type="button"
    variant="outline"
    size="sm"
    class="source-output-panel__collapsed"
    :title="expandLabel"
    :aria-label="expandLabel"
    @click="emit('update:collapsed', false)"
  >
    <FileJson class="size-4" />
    <span class="truncate">{{ title }}</span>
    <slot name="collapsed-meta" />
    <ChevronLeft v-if="mode === 'full-height'" class="size-4" />
    <ChevronDown v-else class="size-4" />
  </Button>

  <aside v-else class="source-output-panel" :data-mode="mode">
    <header class="source-output-panel__header">
      <div class="min-w-0 flex-1">
        <div class="source-output-panel__title">
          <FileJson class="size-4 shrink-0 text-sky-300" />
          <span class="truncate">{{ title }}</span>
          <slot name="meta" />
        </div>
        <div v-if="$slots.subtitle" class="source-output-panel__subtitle">
          <slot name="subtitle" />
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="source-output-panel__toggle"
        :title="collapseLabel"
        :aria-label="collapseLabel"
        @click="emit('update:collapsed', true)"
      >
        <ChevronRight v-if="mode === 'full-height'" class="size-4" />
        <ChevronUp v-else class="size-4" />
      </Button>
    </header>

    <div class="source-output-panel__content">
      <slot />
    </div>
  </aside>
</template>

<style scoped>
.source-output-panel {
  position: absolute;
  top: 12px;
  right: 18px;
  z-index: 6;
  width: min(420px, calc(100% - 36px));
  max-height: min(52%, 420px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgb(71 85 105 / 0.75);
  border-radius: 8px;
  background: rgb(15 23 42 / 0.94);
  color: #e5e7eb;
  box-shadow: 0 18px 40px rgb(0 0 0 / 0.38);
}

.source-output-panel[data-mode='full-height'] {
  inset: 0 0 0 auto;
  width: min(420px, calc(100% - 34px));
  max-height: none;
  border-width: 0 0 0 1px;
  border-radius: 0;
  background: rgb(15 23 42 / 0.97);
  box-shadow: -20px 0 44px rgb(0 0 0 / 0.32);
  backdrop-filter: blur(14px);
}

.source-output-panel__collapsed {
  position: absolute;
  top: 12px;
  right: 18px;
  z-index: 6;
  max-width: min(420px, calc(100% - 36px));
  gap: 7px;
  border-color: rgb(71 85 105 / 0.75);
  background: rgb(15 23 42 / 0.94);
  color: #bfdbfe;
  box-shadow: 0 12px 28px rgb(0 0 0 / 0.28);
}

.source-output-panel__collapsed:hover {
  background: rgb(30 41 59 / 0.97);
  color: #dbeafe;
}

.source-output-panel__header {
  flex: 0 0 auto;
  min-height: 37px;
  padding: 5px 6px 5px 10px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border-bottom: 1px solid rgb(71 85 105 / 0.75);
  color: #93c5fd;
  font-size: 12px;
  font-weight: 600;
}

.source-output-panel[data-mode='full-height'] .source-output-panel__header {
  padding: 9px 8px 8px 12px;
  background: linear-gradient(180deg, rgb(30 41 59 / 0.9), rgb(15 23 42 / 0.84));
}

.source-output-panel__title {
  min-height: 26px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.source-output-panel__subtitle {
  margin-top: 2px;
  overflow: hidden;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 400;
}

.source-output-panel__toggle {
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  color: #bfdbfe;
}

.source-output-panel__toggle:hover {
  background: rgb(51 65 85 / 0.8);
  color: #dbeafe;
}

.source-output-panel__content {
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
  overscroll-behavior: contain;
}
</style>
