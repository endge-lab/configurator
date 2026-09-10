<script setup lang="ts">
import type { RuntimeControlOperation } from '@endge/core'
import { Endge } from '@endge/core'
import { ChevronsDownUp, ChevronsUpDown, Pause, Play, Square } from 'lucide-vue-next'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Configurator } from '@/app/Configurator'
import { Button } from '@/components/ui/button'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import { collectRuntimeTreeExpansion } from '@/features/endge-ide/services/runtime-preview/runtime-tree-view-state'
import RuntimeTreeNode from '@/features/endge-ide/ui/widgets/components/RuntimeTreeNode.vue'

const { t } = useI18n()
const inspection = EndgeIDE.runtimeInspection
const session = Configurator.remoteDebugger
const expanded = shallowRef<ReadonlySet<string>>(new Set())
const busy = ref(false)
const entries = computed(() => [{ key: 'inspection', tree: inspection.tree.value }])
const state = computed(() => inspection.selectedNode.value ? inspection.lifecycleState('', inspection.selectedNode.value) : 'inactive')
const disabled = computed(() => busy.value || !session.canControl.value || !inspection.selectedTarget.value)
let known = new Set<string>()
watch(inspection.tree, () => {
  const available = collectRuntimeTreeExpansion(entries.value, 'expanded')
  expanded.value = new Set([...available].filter(key => expanded.value.has(key) || !known.has(key)))
  known = available
}, { immediate: true })

function toggle(key: string, value: boolean): void {
  const next = new Set(expanded.value)
  if (value) {
    next.add(key)
  }
  else {
    next.delete(key)
  }
  expanded.value = next
}

async function control(operation: RuntimeControlOperation): Promise<void> {
  const target = inspection.selectedTarget.value
  if (!target || disabled.value) {
    return
  }
  busy.value = true
  try {
    await Endge.commands.execute({ type: `runtime:${operation}`, payload: target })
    await session.refreshInspection()
  }
  catch (error) {
    toast.error(t('runtimeInspection.commandFailed'), { description: error instanceof Error ? error.message : String(error) })
  }
  finally { busy.value = false }
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col bg-background" :aria-label="t('runtimeInspection.tree')">
    <div class="flex h-9 shrink-0 items-center justify-between border-b px-1.5">
      <div class="flex items-center">
        <Button variant="ghost" size="icon" class="size-7" :aria-label="t('uiText.collapseAll7786c314')" @click="expanded = new Set()">
          <ChevronsDownUp class="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon" class="size-7" :aria-label="t('uiText.expandAll097a4f4c')" @click="expanded = collectRuntimeTreeExpansion(entries, 'expanded')">
          <ChevronsUpDown class="size-3.5" />
        </Button>
      </div>
      <div class="flex items-center">
        <Button variant="ghost" size="icon" class="size-7" :aria-label="t('uiText.resume3f75368a')" :title="t('uiText.resume3f75368a')" :disabled="disabled || !['paused', 'inactive'].includes(state)" @click="control('resume')">
          <Play class="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon" class="size-7" :aria-label="t('uiText.pause57e32ddd')" :title="t('uiText.pause57e32ddd')" :disabled="disabled || state !== 'active'" @click="control('pause')">
          <Pause class="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon" class="size-7" :aria-label="t('uiText.stopd4f447c1')" :title="t('uiText.stopd4f447c1')" :disabled="disabled || !['active', 'paused', 'error'].includes(state)" @click="control('stop')">
          <Square class="size-3.5" />
        </Button>
      </div>
    </div>
    <div class="min-h-0 flex-1 overflow-auto py-1.5">
      <RuntimeTreeNode
        v-for="node in inspection.tree.value" :key="node.id" entry-key="inspection" :node="node"
        :expanded-node-keys="expanded" selected-entry-key="inspection" :selected-node-id="inspection.selectedNode.value?.id ?? null"
        :lifecycle-state="(key, item) => inspection.lifecycleState(key, item)"
        @toggle-expanded="toggle" @select="(key, item) => inspection.select(key, item)"
      />
      <p v-if="!inspection.tree.value.length" class="px-5 py-10 text-center text-xs text-muted-foreground">
        {{ t('runtimeInspection.emptyTree') }}
      </p>
    </div>
    <p class="shrink-0 border-t px-3 py-2 text-[10px] leading-4 text-muted-foreground">
      {{ t('runtimeInspection.selectHint') }}
    </p>
  </section>
</template>
