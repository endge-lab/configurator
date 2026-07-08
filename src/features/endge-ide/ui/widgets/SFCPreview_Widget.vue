<script setup lang="ts">
import { SFC_RuntimeRenderer } from '@endge/vue'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import {
  destroySFCPreviewRuntime,
  sfcPreviewError,
  sfcPreviewInput,
  sfcPreviewRuntime,
  sfcPreviewTitle,
} from '@/features/endge-ide/model/sfc-preview/sfc-preview-state'

const runtime = computed(() => sfcPreviewRuntime.value)
const input = computed(() => sfcPreviewInput.value)
const error = computed(() => sfcPreviewError.value)
const title = computed(() => sfcPreviewTitle.value)
</script>

<template>
  <div class="sfc-preview-widget flex h-full min-h-0 flex-col bg-background">
    <div class="flex h-11 shrink-0 items-center gap-2 border-b px-3">
      <div class="min-w-0 flex-1 truncate text-sm font-semibold">
        {{ title }}
      </div>
      <Button
        v-if="runtime"
        type="button"
        variant="outline"
        size="sm"
        @click="destroySFCPreviewRuntime"
      >
        Остановить
      </Button>
    </div>

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
      Запустите демонстрацию SFC-компонента из редактора.
    </div>
  </div>
</template>

<style scoped>
.sfc-preview-widget {
  min-height: 220px;
}
</style>
