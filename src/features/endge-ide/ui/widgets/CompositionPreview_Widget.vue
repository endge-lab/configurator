<script setup lang="ts">
import { EndgeFilterRenderer, SFC_RuntimeRenderer } from '@endge/vue'
import { computed, onBeforeUnmount } from 'vue'

import { Button } from '@/components/ui/button'
import {
  compositionPreviewError,
  compositionPreviewRenderables,
  compositionPreviewRuntime,
  compositionPreviewTitle,
  destroyCompositionPreviewRuntime,
} from '@/features/endge-ide/model/composition-preview/composition-preview-state'

const runtime = computed(() => compositionPreviewRuntime.value)
const error = computed(() => compositionPreviewError.value)
const title = computed(() => compositionPreviewTitle.value)
const renderables = computed(() => compositionPreviewRenderables.value)

onBeforeUnmount(() => {
  void destroyCompositionPreviewRuntime()
})
</script>

<template>
  <div class="composition-preview-widget flex h-full min-h-0 flex-col bg-background">
    <div class="flex h-11 shrink-0 items-center gap-2 border-b px-3">
      <div class="min-w-0 flex-1 truncate text-sm font-semibold">
        {{ title }}
      </div>
      <Button
        v-if="runtime"
        type="button"
        variant="outline"
        size="sm"
        @click="destroyCompositionPreviewRuntime"
      >
        Остановить
      </Button>
    </div>

    <div v-if="error" class="m-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      {{ error }}
    </div>

    <div v-else-if="runtime" class="min-h-0 flex-1 overflow-auto">
      <div v-if="renderables.length" class="composition-preview-widget__stack">
        <section
          v-for="item in renderables"
          :key="item.key"
          class="composition-preview-widget__section"
        >
          <div class="composition-preview-widget__title">
            {{ item.title }}
          </div>
          <EndgeFilterRenderer
            v-if="item.kind === 'filter-view'"
            :runtime="item.runtime"
          />
          <SFC_RuntimeRenderer
            v-else-if="item.kind === 'component-sfc'"
            :host="item.runtime"
            :input="item.input"
          />
        </section>
      </div>
      <div v-else class="flex min-h-full items-center justify-center p-4 text-sm text-muted-foreground">
        {{ 'В композиции нет runtime-сущностей с доступной визуализацией.' }}
      </div>
    </div>

    <div v-else class="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
      Запустите демонстрацию композиции из редактора.
    </div>
  </div>
</template>

<style scoped>
.composition-preview-widget {
  min-height: 260px;
}

.composition-preview-widget__stack {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.composition-preview-widget__section {
  display: grid;
  min-width: 0;
  gap: .75rem;
}

.composition-preview-widget__title {
  min-width: 0;
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: .75rem;
  font-weight: 600;
  line-height: 1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
