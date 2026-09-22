<script setup lang="ts">
import { Endge } from '@endge/core'
import { ChevronFirst, ChevronLast, Pause, Play, StepBack, StepForward } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Configurator } from '@/app/Configurator'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const { t } = useI18n()
const session = Configurator.remoteDebugger
const revision = ref(0)
onBeforeUnmount(Endge.inspection.subscribe(() => revision.value++))
const controls = computed(() => {
  void revision.value
  const inspection = Endge.inspection
  const first = inspection.records[0]?.sequence
  const latest = inspection.receivedSequence
  const empty = first === undefined
  return [
    { label: t('bundleInspection.beginning'), icon: ChevronFirst, disabled: empty, run: () => session.seek(first!) },
    { label: t('bundleInspection.previous'), icon: StepBack, disabled: empty || inspection.appliedSequence === first, run: () => {
      session.pause()
      inspection.setFollowLive(false)
      inspection.stepBackward()
    } },
    { label: t('bundleInspection.next'), icon: StepForward, disabled: empty || inspection.appliedSequence === latest, run: () => {
      session.pause()
      inspection.setFollowLive(false)
      inspection.stepForward()
    } },
    { label: session.playing.value ? t('bundleInspection.pause') : t('bundleInspection.play'), icon: session.playing.value ? Pause : Play, disabled: empty, run: () => session.play() },
    { label: t('bundleInspection.latest'), icon: ChevronLast, disabled: latest === null, run: () => session.seek(latest!) },
  ]
})
function invoke(action: () => void): void {
  try {
    action()
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  }
}
</script>

<template>
  <div class="flex items-center gap-0.5" data-testid="inspection-controls">
    <Tooltip v-for="control in controls" :key="control.label">
      <TooltipTrigger as-child>
        <span class="inline-flex">
          <Button variant="ghost" size="icon" class="size-7" :aria-label="control.label" :disabled="control.disabled" @click="invoke(control.run)">
            <component :is="control.icon" class="size-4" />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{{ control.label }}</TooltipContent>
    </Tooltip>
  </div>
</template>
