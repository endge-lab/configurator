<script setup lang="ts">
import type { Ref } from 'vue'

// utils
import { extractTime, formatDatetimeTZ } from '@endge/utils'
import { useUI } from '@endge/ui-vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type TimeZoneMode = 'LT' | 'UTC'

const ui = useUI() as Ref<any>

const timeZones = {
  LT: 'LT',
  UTC: 'UTC',
} as const

const isLocalTime = computed<boolean>(() => ui.value.snapshot.isLocalTime)

const timeZone = computed<TimeZoneMode>(() =>
  isLocalTime.value ? timeZones.LT : timeZones.UTC,
)

const time = ref<string>('')
const dateString = ref<string>('')

let tick: number | null = null

function updateNow(): void {
  const local = isLocalTime.value

  time.value = extractTime(new Date(), local)
  dateString.value = formatDatetimeTZ(new Date(), 'dd.MM', {}, local)
}

function startTick(): void {
  stopTick()
  updateNow()
  tick = window.setInterval(updateNow, 1000)
}

function stopTick(): void {
  if (tick != null) {
    window.clearInterval(tick)
    tick = null
  }
}

function toggleTime(): void {
  ui.value.switchTime()
  updateNow()
}

watch(
  () => ui.value.snapshot.isLocalTime,
  () => startTick(),
)

onMounted(startTick)
onBeforeUnmount(stopTick)

const badgeText = computed<string>(() => `${timeZone.value} ${dateString.value}`)
</script>

<template>
  <div class="relative inline-flex items-center cursor-pointer">
    <!-- BADGE -->
    <Badge
      variant="secondary"
      class="absolute -top-2 -right-2 px-2 py-0.5 text-[10px] leading-none select-none pointer-events-none"
    >
      {{ badgeText }}
    </Badge>

    <!-- BUTTON -->
    <Button
      variant="outline"
      size="sm"
      class="h-8 px-3 font-mono"
      @click="toggleTime"
    >
      {{ time }}
    </Button>
  </div>
</template>
