<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { Endge } from '@endge/core'
import { SFC_Renderer } from '@endge/vue'
import type { ComponentSFCRuntimeHost, RComponentSFC_IR } from '@endge/core'

const SFC_IDENTITY = 'test-sfc'

const runtime = shallowRef<ComponentSFCRuntimeHost | null>(null)
const isExecuting = ref(false)
const errorMessage = ref<string | null>(null)
const renderVersion = ref(0)
const renderProps = ref<Record<string, unknown>>({})

const ir = computed<RComponentSFC_IR | null>(() => runtime.value?.getIr() ?? null)

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
    renderProps.value = { ...(host.getPreviewProps() ?? {}) }
    renderVersion.value++
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
  renderProps.value = {}
  renderVersion.value++
}

function toggleCompact(): void {
  renderProps.value = {
    ...renderProps.value,
    compact: !Boolean(renderProps.value.compact),
  }
  renderVersion.value++
}

function cycleStatus(): void {
  const flight = isRecord(renderProps.value.flight)
    ? renderProps.value.flight
    : {}

  renderProps.value = {
    ...renderProps.value,
    flight: {
      ...flight,
      status: flight.status === 'Boarding' ? 'Delayed' : 'Boarding',
      statusTone: flight.status === 'Boarding' ? 'warning' : 'success',
    },
  }
  renderVersion.value++
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
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
      <div class="flex items-center justify-between gap-3">
        <div class="text-sm text-muted-foreground">
          {{ runtime.runtimeType }} / {{ runtime.entityIdentity }}
        </div>

        <div class="flex items-center gap-2">
          <button
            class="px-3 py-2 border rounded bg-background hover:bg-muted disabled:opacity-50"
            type="button"
            :disabled="!ir"
            @click="cycleStatus"
          >
            Cycle status
          </button>

          <button
            class="px-3 py-2 border rounded bg-background hover:bg-muted disabled:opacity-50"
            type="button"
            :disabled="!ir"
            @click="toggleCompact"
          >
            Toggle compact
          </button>
        </div>
      </div>

      <div v-if="ir" class="border rounded p-4">
        <SFC_Renderer
          :ir="ir"
          :props="renderProps"
          :render-version="renderVersion"
        />
      </div>

      <p v-else class="text-sm text-muted-foreground">
        Runtime executed, but compiled SFC IR is missing.
      </p>

      <pre class="text-xs overflow-auto border rounded p-3">{{ renderProps }}</pre>
    </section>
  </main>
</template>
