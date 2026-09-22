<script setup lang="ts">
import { useUI } from '@endge/ui-vue'
import { Minus, Plus, RefreshCw, ZoomIn } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'

const ui = useUI()

const zoomDisabled = false

function percentageFormatter(value: number): string {
  return `${value} %`
}
function resetZoom(): void {
  ui.value.setZoom(100)
}

function zoomUp(): void {
  ui.value.setZoom(ui.value.zoom + 25)
}

function zoomDown(): void {
  ui.value.setZoom(ui.value.zoom - 25)
}
</script>

<template>
  <div
    class="zoom inline-flex items-center rounded-md px-1"
    :data-disabled="zoomDisabled ? 'true' : 'false'"
  >
    <div class="px-2">
      <ZoomIn class="h-5 w-5 text-primary" />
    </div>

    <Button
      variant="ghost"
      size="icon"
      class="h-8 w-8"
      :disabled="zoomDisabled"
      @click.stop="resetZoom"
    >
      <RefreshCw class="h-5 w-5 text-primary" />
    </Button>

    <Button
      variant="ghost"
      class="h-8 px-2 font-bold"
      :disabled="zoomDisabled"
      @click.stop="zoomDown"
    >
      <Minus class="h-4 w-4" />
    </Button>

    <div class="px-2 text-xs whitespace-nowrap">
      {{ percentageFormatter(ui.zoom) }}
    </div>

    <Button
      variant="ghost"
      class="h-8 px-2"
      :disabled="zoomDisabled"
      @click.stop="zoomUp"
    >
      <Plus class="h-4 w-4" />
    </Button>
  </div>
</template>

<style scoped lang="scss">
.zoom[data-disabled='true'] {
  pointer-events: none;
  opacity: 0.55;

  * {
    opacity: 0.8;
  }
}
</style>
