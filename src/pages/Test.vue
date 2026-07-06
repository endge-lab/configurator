<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { Endge } from '@endge/core'
import type { ComponentSFCRuntimeHost, ProgramDiagnostic } from '@endge/core'

const SFC_IDENTITY = 'test-sfc'

const runtime = shallowRef<ComponentSFCRuntimeHost | null>(null)
const errorMessage = ref<string | null>(null)
const isExecuting = ref(false)

const runtimeSnapshot = computed(() => runtime.value?.snapshot() ?? null)
const diagnostics = computed<ProgramDiagnostic[]>(() => runtime.value?.getDiagnostics() ?? [])

async function executeSFC(): Promise<void> {
  errorMessage.value = null
  isExecuting.value = true

  try {
    if (runtime.value)
      Endge.runtime.destroyRuntime(runtime.value.id)

    await Endge.build()

    const component = Endge.domain.getComponentSFC(SFC_IDENTITY)
    if (!component) {
      runtime.value = null
      errorMessage.value = `SFC component "${SFC_IDENTITY}" not found.`
      return
    }

    runtime.value = Endge.runtime.execute(component, {
      target: 'dom',
    }) as ComponentSFCRuntimeHost | null

    if (!runtime.value)
      errorMessage.value = `SFC component "${SFC_IDENTITY}" was not executed.`
  }
  catch (error) {
    runtime.value = null
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    isExecuting.value = false
  }
}

function destroyRuntime(): void {
  if (!runtime.value)
    return

  Endge.runtime.destroyRuntime(runtime.value.id)
  runtime.value = null
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

    <p v-if="errorMessage" class="text-sm text-red-600">
      {{ errorMessage }}
    </p>

    <section v-if="runtime" class="flex flex-col gap-2">
      <h2 class="text-base font-semibold">
        Runtime
      </h2>

      <dl class="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1 text-sm">
        <dt class="text-muted-foreground">
          id
        </dt>
        <dd>{{ runtime.id }}</dd>

        <dt class="text-muted-foreground">
          type
        </dt>
        <dd>{{ runtime.runtimeType }}</dd>

        <dt class="text-muted-foreground">
          status
        </dt>
        <dd>{{ runtime.status }}</dd>

        <dt class="text-muted-foreground">
          entity
        </dt>
        <dd>{{ runtime.entityType }} / {{ runtime.entityIdentity }}</dd>
      </dl>
    </section>

    <section v-if="diagnostics.length" class="flex flex-col gap-2">
      <h2 class="text-base font-semibold">
        Diagnostics
      </h2>

      <pre class="text-xs overflow-auto border rounded p-3">{{ diagnostics }}</pre>
    </section>

    <section v-if="runtimeSnapshot" class="flex flex-col gap-2 min-h-0">
      <h2 class="text-base font-semibold">
        Snapshot
      </h2>

      <pre class="text-xs overflow-auto border rounded p-3">{{ runtimeSnapshot }}</pre>
    </section>
  </main>
</template>

<style scoped>

</style>
