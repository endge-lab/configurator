<script setup lang="ts">
import { BUILTIN_ACTION_IDS, Endge } from '@endge/core'
import { useSubscribableRefAuto } from '@endge/ui-vue'
import { Square } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'

const { t } = useI18n()
const revision = useSubscribableRefAuto(Endge.diagnostics.snapshots)
const recording = computed(() => {
  void revision.value
  return Endge.diagnostics.recordingState
})
const finishing = ref(false)

async function stopAndDownload(): Promise<void> {
  const active = recording.value
  if (active.status !== 'recording' || finishing.value) {
    return
  }
  finishing.value = true
  try {
    await Endge.actions.execute(BUILTIN_ACTION_IDS.diagnosticsStopRecording)
    await Endge.actions.execute(BUILTIN_ACTION_IDS.diagnosticsDownload, {
      input: { source: 'recording', recordingId: active.id },
    })
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : t('diagnostics.recording.actionFailed'))
  }
  finally {
    finishing.value = false
  }
}
</script>

<template>
  <div
    v-if="recording.status === 'recording'"
    class="fixed right-3 bottom-9 z-40 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-md border bg-background p-2 text-xs shadow-md"
  >
    <span role="status" class="flex items-center gap-2 px-1 font-medium">
      <span class="size-2 shrink-0 rounded-full bg-destructive" aria-hidden="true" />
      {{ $t('diagnostics.recording.active') }}
    </span>
    <Button type="button" size="sm" variant="outline" :disabled="finishing" @click="stopAndDownload">
      <Square class="size-3" />
      {{ $t('diagnostics.recording.stopAndDownload') }}
    </Button>
  </div>
</template>
