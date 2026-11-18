<script setup lang="ts">
import { Endge } from '@endge/core'
import { computed, onBeforeUnmount, ref } from 'vue'
import { getControllerCatalogDefinitions } from '@/features/endge-ide/services/controllers/controller-catalog'

const version = ref(0)
const unsubscribe = Endge.runtime.controllers.subscribe(() => {
  version.value += 1
})
const unsubscribeProgram = Endge.program.subscribe(() => {
  version.value += 1
})
onBeforeUnmount(() => {
  unsubscribe()
  unsubscribeProgram()
})
const definitions = computed(() => {
  void version.value
  return getControllerCatalogDefinitions()
})
</script>

<template>
  <details class="mb-3 rounded border p-2" data-controller-catalog>
    <summary class="cursor-pointer text-xs font-medium">
      {{ $t("controllers.catalog") }}
    </summary>
    <p class="my-2 text-xs text-muted-foreground">
      {{ $t("controllers.hint") }}
    </p>
    <details
      v-for="definition in definitions"
      :key="definition.identity"
      class="mb-2 text-xs"
    >
      <summary class="cursor-pointer">
        {{ definition.displayName }} <code>{{ definition.identity }}</code>
      </summary>
      <dl class="my-2 grid grid-cols-[auto_1fr] gap-x-2">
        <dt>{{ $t("controllers.origin") }}</dt>
        <dd>{{ definition.origin }}</dd>
        <dt>{{ $t("controllers.catalogPath") }}</dt>
        <dd>{{ definition.catalogPath?.join(" / ") || "—" }}</dd>
        <dt>{{ $t("controllers.provider") }}</dt>
        <dd>
          <code>{{ definition.defaultProviderKey }}</code>
        </dd>
      </dl>
      <pre
        class="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-muted p-2"
      >{{ JSON.stringify(definition.contract, null, 2) }}</pre>
    </details>
  </details>
</template>
