<script setup lang="ts">
import type { StoreRuntimeHost } from '@endge/core'

import { Endge } from '@endge/core'
import { Raph } from '@endge/raph'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { pulseSelectedHost, pulseStatusDotClass, pulseStatusLabel } from '@/features/endge-ide/model/pulse/pulse.mock.ts'

const host = computed(() => pulseSelectedHost.value)
const storeRevision = ref(0)
let disposeStoreWatch: VoidFunction | null = null

watch(
  () => host.value?.id ?? null,
  (runtimeId) => {
    disposeStoreWatch?.()
    disposeStoreWatch = null
    if (!runtimeId || host.value?.entityType !== 'store') {
      return
    }
    const runtime = Endge.runtime.getRuntimeById<StoreRuntimeHost>(runtimeId)
    if (!runtime) {
      return
    }
    const path = runtime.getDataPath()
    disposeStoreWatch = Raph.watch([path, `${path}.*`], () => {
      storeRevision.value += 1
    })
  },
  { immediate: true },
)

onBeforeUnmount(() => disposeStoreWatch?.())

const storeFields = computed(() => {
  void storeRevision.value
  if (host.value?.entityType !== 'store') {
    return []
  }

  const runtime = Endge.runtime.getRuntimeById<StoreRuntimeHost>(host.value.id)
  if (!runtime) {
    return []
  }
  const snapshot = runtime.getDataSnapshot()
  return runtime.getFields().map(field => ({
    key: field.key,
    kind: field.kind,
    source: field.kind === 'derived' ? field.source : null,
    dataViews: field.kind === 'derived' ? field.dataViews.length : 0,
    value: snapshot[field.key],
  }))
})

function formatValue(value: unknown): string {
  if (value === undefined) {
    return 'undefined'
  }
  try {
    return JSON.stringify(value, null, 2)
  }
  catch {
    return String(value)
  }
}
</script>

<template>
  <div class="p-4">
    <div v-if="host" class="space-y-4">
      <div class="rounded-xl border bg-background p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-base font-semibold">{{ host.title }}</h2>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <div
                      class="size-2.5 rounded-full shrink-0"
                      :class="pulseStatusDotClass(host.status)"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {{ pulseStatusLabel(host.status) }}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div class="mt-1 text-sm text-muted-foreground">
              {{ host.entityType }} -> {{ host.runtimeType }} -> {{ host.id }}
            </div>
            <div class="mt-3 text-sm text-muted-foreground">
              {{ host.description }}
            </div>
          </div>

          <div class="rounded-xl border bg-muted/20 px-4 py-3 text-right">
            <div class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">uptime</div>
            <div class="mt-1 text-lg font-semibold">{{ host.uptime }}</div>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <span
            v-for="tag in host.tags"
            :key="tag"
            class="rounded-full border bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground"
          >
            {{ tag }}
          </span>
        </div>
      </div>

      <section
        v-if="host.entityType === 'store'"
        class="rounded-xl border bg-background p-4"
      >
        <div class="mb-3 flex items-center justify-between">
          <div>
            <div class="text-sm font-semibold">Store state</div>
            <div class="mt-1 text-xs text-muted-foreground">
              Raw values и результаты derived DataView из текущего Raph state.
            </div>
          </div>
          <div class="text-xs text-muted-foreground">{{ storeFields.length }} fields</div>
        </div>

        <div class="grid gap-3 xl:grid-cols-2">
          <article
            v-for="field in storeFields"
            :key="field.key"
            class="min-w-0 rounded-lg border bg-muted/20 p-3"
          >
            <div class="flex flex-wrap items-center gap-2">
              <div class="text-xs font-semibold">{{ field.key }}</div>
              <span class="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                {{ field.kind }}
              </span>
              <span
                v-if="field.kind === 'derived'"
                class="text-[10px] text-muted-foreground"
              >
                {{ field.source }} · {{ field.dataViews }} DataView
              </span>
            </div>
            <pre class="mt-3 max-h-72 overflow-auto rounded-md bg-background p-3 text-[11px] leading-5">{{ formatValue(field.value) }}</pre>
          </article>
        </div>
      </section>

      <div class="grid gap-4 xl:grid-cols-2">
        <section class="rounded-xl border bg-background p-4">
          <div class="mb-3 flex items-center justify-between">
            <div class="text-sm font-semibold">Ресурсы внутри</div>
            <div class="text-xs text-muted-foreground">{{ host.resources.length }}</div>
          </div>
          <div class="space-y-2">
            <div
              v-for="resource in host.resources"
              :key="resource.id"
              class="rounded-lg border bg-muted/20 px-3 py-2"
            >
              <div class="text-xs font-medium">{{ resource.title }}</div>
              <div class="mt-1 text-xs text-muted-foreground">{{ resource.subtitle }}</div>
            </div>
          </div>
        </section>

        <section class="rounded-xl border bg-background p-4">
          <div class="mb-3 flex items-center justify-between">
            <div class="text-sm font-semibold">Подписки</div>
            <div class="text-xs text-muted-foreground">{{ host.subscriptions.length }}</div>
          </div>
          <div class="space-y-2">
            <div
              v-for="subscription in host.subscriptions"
              :key="subscription.id"
              class="rounded-lg border bg-muted/20 px-3 py-2"
            >
              <div class="text-xs font-medium">{{ subscription.title }}</div>
              <div class="mt-1 text-xs text-muted-foreground">{{ subscription.subtitle }}</div>
            </div>
          </div>
        </section>

        <section class="rounded-xl border bg-background p-4">
          <div class="mb-3 flex items-center justify-between">
            <div class="text-sm font-semibold">Contract bindings</div>
            <div class="text-xs text-muted-foreground">{{ host.bindings.length }}</div>
          </div>
          <div class="space-y-2">
            <div
              v-for="binding in host.bindings"
              :key="binding.id"
              class="rounded-lg border bg-muted/20 px-3 py-2"
            >
              <div class="text-xs font-medium">{{ binding.title }}</div>
              <div class="mt-1 text-xs text-muted-foreground">{{ binding.subtitle }}</div>
            </div>
          </div>
        </section>

        <section class="rounded-xl border bg-background p-4">
          <div class="mb-3 flex items-center justify-between">
            <div class="text-sm font-semibold">Контракты</div>
            <div class="text-xs text-muted-foreground">{{ host.contracts.length }}</div>
          </div>
          <div class="space-y-2">
            <div
              v-for="contract in host.contracts"
              :key="contract.id"
              class="rounded-lg border bg-muted/20 px-3 py-2"
            >
              <div class="text-xs font-medium">{{ contract.title }}</div>
              <div class="mt-1 text-xs text-muted-foreground">{{ contract.subtitle }}</div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <div v-else class="rounded-xl border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
      Выберите runtime-host в sidebar справа.
    </div>
  </div>
</template>
