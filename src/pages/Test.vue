<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { Endge } from '@endge/core'
import { Raph } from '@endge/raph'
import { SFC_RuntimeRenderer } from '@endge/vue'
import type { ComponentSFCRuntimeHost, EndgeBootContext } from '@endge/core'
import type { SFCVueRuntimeInputSource } from '@endge/vue'

const SFC_IDENTITY = 'test-sfc-table'
const RAPH_FLIGHTS_PATH = 'test.sfc.flights'
const MANUAL_BOOT_CONTEXT = {} as EndgeBootContext

const runtime = shallowRef<ComponentSFCRuntimeHost | null>(null)
const isExecuting = ref(false)
const errorMessage = ref<string | null>(null)
const raphSnapshot = shallowRef<Record<string, unknown>>({})

const renderInput = computed<SFCVueRuntimeInputSource>(() => ({
  kind: 'raph',
  bindings: {
    flights: {
      path: RAPH_FLIGHTS_PATH,
      wildcardDynamic: true,
    },
  },
}))

async function executeSFC(): Promise<void> {
  isExecuting.value = true
  errorMessage.value = null

  try {
    destroyRuntime()
    prepareManualSFCExecution()

    const component = Endge.domain.getComponentSFC(SFC_IDENTITY)
    if (!component) {
      runtime.value = null
      resetRuntimeRenderState()
      errorMessage.value = `SFC component "${SFC_IDENTITY}" not found.`
      return
    }

    const host = Endge.runtime.execute(component, {
      target: 'dom',
      input: renderInput.value,
    }) as ComponentSFCRuntimeHost | null

    if (!host) {
      errorMessage.value = `SFC component "${SFC_IDENTITY}" was not executed.`
      return
    }

    seedRaphInput(host)
    runtime.value = host
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

function incrementCounter(): void {
  const flights = normalizeFlights(Raph.get(RAPH_FLIGHTS_PATH))
  const firstFlight = flights[0] ?? {}
  const nextCounter = Number(firstFlight.counter ?? 0) + 1

  Raph.set(`${RAPH_FLIGHTS_PATH}[0].counter`, nextCounter)
  refreshRaphSnapshot()
}

function prepareManualSFCExecution(): void {
  Endge.compiler.build(MANUAL_BOOT_CONTEXT)
  Endge.runtime.start()
}

function resetRuntimeRenderState(): void {
  raphSnapshot.value = {}
}

function seedRaphInput(host: ComponentSFCRuntimeHost): void {
  const previewProps = host.getPreviewProps() ?? {}
  const flights = normalizeFlights(previewProps.flights)

  Raph.set(RAPH_FLIGHTS_PATH, flights.length > 0
    ? flights
    : [
        {
          id: 'SU1402',
          number: 'SU 1402',
          status: 'Boarding',
          statusTone: 'success',
          std: '2026-07-05T13:45:00Z',
          route: 'SVO -> LED',
          counter: 0,
        },
      ])
  refreshRaphSnapshot()
}

function refreshRaphSnapshot(): void {
  raphSnapshot.value = {
    flights: cloneValue(Raph.get(RAPH_FLIGHTS_PATH)),
  }
}

function normalizeFlights(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw))
    return []

  return raw
    .filter(item => item && typeof item === 'object' && !Array.isArray(item))
    .map(item => ({
      ...(item as Record<string, unknown>),
      counter: Number((item as Record<string, unknown>).counter ?? 0),
    }))
}

function cloneValue(value: unknown): unknown {
  if (value == null)
    return value

  try {
    return JSON.parse(JSON.stringify(value))
  }
  catch {
    return value
  }
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
        {{ isExecuting ? 'Executing...' : 'Execute test-sfc-table' }}
      </button>

      <button
        class="px-3 py-2 border rounded bg-background hover:bg-muted disabled:opacity-50"
        type="button"
        :disabled="!runtime"
        @click="destroyRuntime"
      >
        Destroy runtime
      </button>

      <button
        class="px-3 py-2 border rounded bg-background hover:bg-muted disabled:opacity-50"
        type="button"
        :disabled="!runtime"
        @click="incrementCounter"
      >
        Increment counter
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

      <pre class="text-xs overflow-auto border rounded p-3">{{ raphSnapshot }}</pre>
    </section>
  </main>
</template>
