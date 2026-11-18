<script setup lang="ts">
import type { ControllerRuntimeHost, RuntimeHost } from '@endge/core'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { resolveControllerCatalogDefinition } from '@/features/endge-ide/services/controllers/controller-catalog'
import SourceJsonTree from '@/features/endge-ide/ui/components/SourceJsonTree.vue'

const props = defineProps<{ runtime: RuntimeHost<any, any> }>()
const revision = ref(0)
const lastError = ref<string | null>(null)
let unsubscribe: (() => void) | undefined
watch(
  () => props.runtime,
  (runtime) => {
    unsubscribe?.()
    lastError.value = null
    const refresh = () => {
      if (runtime.snapshot().context.status === 'success') {
        lastError.value = null
      }
      revision.value += 1
    }
    const reportError = (event: { error: unknown }) => {
      lastError.value = event.error instanceof Error ? event.error.message : String(event.error)
      refresh()
    }
    const outputs = (runtime as ControllerRuntimeHost).subscribe(refresh)
    runtime.on('status-changed', refresh)
    runtime.on('update', refresh)
    runtime.on('controller:error', reportError)
    unsubscribe = () => {
      outputs()
      runtime.off('status-changed', refresh)
      runtime.off('update', refresh)
      runtime.off('controller:error', reportError)
    }
    revision.value += 1
  },
  { immediate: true },
)
onBeforeUnmount(() => unsubscribe?.())
const state = computed(() => {
  void revision.value
  const host = props.runtime as ControllerRuntimeHost
  const definition = resolveControllerCatalogDefinition(host.entityIdentity)
  const outputs = host.getOutputs()
  return {
    lifecycle: host.status,
    props: host.getProps(),
    outputs,
    context: host.snapshot().context,
    error: outputs.error ?? lastError.value,
    provider: definition?.defaultProviderKey,
    dependencies: host.meta.controllerDependencies,
    contract: definition?.contract,
  }
})
</script>

<template>
  <section class="space-y-3 p-4" data-controller-preview>
    <p class="text-xs text-muted-foreground">
      {{ $t("controllers.preview") }}
    </p>
    <SourceJsonTree :data="state" />
    <p v-if="state.outputs.refreshPending" role="status" class="text-sm text-amber-700">
      {{ $t('controllers.refreshPending') }}
    </p>
  </section>
</template>
