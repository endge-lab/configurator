<script setup lang="ts">
import type { EndgePreviewTarget } from '@/features/endge-preview/domain/types/preview.types'

import { Endge } from '@endge/core'
import { CircleAlert } from 'lucide-vue-next'
import { onBeforeMount, onBeforeUnmount, ref, watch } from 'vue'

import { endgePreviewSession } from '@/features/endge-preview/model/core/endge-preview-state'
import { embeddedEndgePreviewTarget } from '@/features/endge-preview/model/navigation/open-embedded-preview'
import RuntimePreviewWorkspace from '@/features/endge-preview/ui/RuntimePreviewWorkspace.vue'

const error = ref<string | null>(null)
const session = endgePreviewSession

function resolveEmbeddedTarget(): EndgePreviewTarget | null {
  if (embeddedEndgePreviewTarget.value) {
    return embeddedEndgePreviewTarget.value
  }
  const identity = String(Endge.context.getCurrentProject() ?? '').trim()
  return identity ? { entityType: 'project', identity } : null
}

async function openTarget(target: EndgePreviewTarget): Promise<void> {
  error.value = null
  try {
    await session.open(target)
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

onBeforeMount(async () => {
  const target = resolveEmbeddedTarget()
  if (!target) {
    error.value = 'В текущем контексте нет доступного проекта.'
    return
  }
  session.init({ resolveTargetAfterContextBoot: resolveEmbeddedTarget })
  await openTarget(target)
})

watch(embeddedEndgePreviewTarget, (target) => {
  if (target) {
    void openTarget(target)
  }
})

onBeforeUnmount(() => {
  void session.dispose()
})
</script>

<template>
  <div v-if="error" class="flex h-full items-center justify-center p-8">
    <div class="flex max-w-xl items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
      <CircleAlert class="mt-0.5 size-4 shrink-0" />
      <span>{{ error }}</span>
    </div>
  </div>
  <RuntimePreviewWorkspace v-else show-external-link />
</template>
