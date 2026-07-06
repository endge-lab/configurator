<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { Endge } from '@endge/core'
import { SFC_RuntimeRenderer } from '@endge/vue'
import type { ComponentSFCRuntimeHost } from '@endge/core'
import type { SFCVueRuntimeInputSource } from '@endge/vue'

const SFC_IDENTITY = 'test-sfc'

const runtime = shallowRef<ComponentSFCRuntimeHost | null>(null)
const isExecuting = ref(false)
const errorMessage = ref<string | null>(null)
const localProps = shallowRef<Record<string, unknown>>({})

const renderInput = computed<SFCVueRuntimeInputSource>(() => ({
  kind: 'local',
  props: localProps.value,
}))

async function executeSFC(): Promise<void> {
  isExecuting.value = true
  errorMessage.value = null

  try {
    destroyRuntime()
    await Endge.build()

    const component = Endge.domain.getComponentSFC(SFC_IDENTITY)
    if (!component) {
      runtime.value = null
      resetRuntimeRenderState()
      errorMessage.value = `SFC component "${SFC_IDENTITY}" not found.`
      return
    }

    const host = Endge.runtime.execute(component, {
      target: 'dom',
    }) as ComponentSFCRuntimeHost | null

    if (!host) {
      errorMessage.value = `SFC component "${SFC_IDENTITY}" was not executed.`
      return
    }

    runtime.value = host
    localProps.value = { ...(host.getPreviewProps() ?? {}) }
  }
  catch (error) {
    resetRuntimeRenderState()
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    isExecuting.value = false
  }
}

function destroyRuntime(): void {
  if (runtime.value)
    Endge.runtime.destroyRuntime(runtime.value.id)
  runtime.value = null
  resetRuntimeRenderState()
}

function resetRuntimeRenderState(): void {
  localProps.value = {}
}

onBeforeUnmount(() => {
  destroyRuntime()
})
</script>

<template>
  <main class="p-6 flex flex-col gap-4">
    <div class="flex items-center gap-3">
      <button
        class="px-3 py-2 border rounded bg-background hover:bg-muted"
        type="button"
        :disabled="isExecuting"
        @click="executeSFC"
      >
        {{ isExecuting ? 'Executing...' : 'Execute test-sfc' }}
      </button>

      <button
        class="px-3 py-2 border rounded bg-background hover:bg-muted disabled:opacity-50"
        type="button"
        :disabled="!runtime"
        @click="destroyRuntime"
      >
        Destroy runtime
      </button>
    </div>

    <p v-if="errorMessage" class="text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <section v-if="runtime" class="flex flex-col gap-3 min-h-0">
      <div class="text-sm text-muted-foreground">
        {{ runtime.runtimeType }} / {{ runtime.entityIdentity }}
      </div>

      <div class="border rounded p-4">
        <SFC_RuntimeRenderer
          :host="runtime"
          :input="renderInput"
        />
      </div>

      <pre class="text-xs overflow-auto border rounded p-3">{{ localProps }}</pre>
    </section>
  </main>
</template>
