<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text, style/max-statements-per-line */
import type { EndgePreviewEntityType, EndgePreviewTarget } from '@/features/endge-preview/domain/types/preview.types'

import { ArrowLeft, RefreshCw } from 'lucide-vue-next'
import { computed, onBeforeMount, onBeforeUnmount, ref } from 'vue'
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'

import { useLayout } from '@/components/layouts/grid'
import { Button } from '@/components/ui/button'
import { EnvironmentSwitcher, LocaleSwitcher, ProjectSwitcher, TenantSwitcher, ThemeSwitcher } from '@/features/endge-configurator/ui/context'
import { EndgePreview } from '@/features/endge-preview/model/core/endge-preview'
import { endgePreviewSession } from '@/features/endge-preview/model/core/endge-preview-state'
import EntityPreview from '@/features/endge-preview/ui/views/EntityPreview.vue'

const route = useRoute()
const router = useRouter()
const error = ref<string | null>(null)
const loading = ref(false)
const session = endgePreviewSession

const title = computed(() => {
  const target = session.target.value
  return target ? `Preview · ${target.identity}` : 'Endge Preview'
})

useLayout({ title, isLoading: loading })

function targetFromRoute(value = route): EndgePreviewTarget {
  const entityType = String(value.params.entityType ?? '').trim()
  const identity = String(value.params.identity ?? '').trim()
  if (!isPreviewEntityType(entityType)) { throw new Error(`Preview entity type "${entityType}" is not supported.`) }
  if (!identity) { throw new Error('Preview identity is required.') }
  return { entityType, identity }
}

async function open(target: EndgePreviewTarget, initialize = false): Promise<void> {
  loading.value = true
  error.value = null
  try {
    if (initialize) {
      await EndgePreview.init(target)
    }
    else { await EndgePreview.open(target) }
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
  finally { loading.value = false }
}

async function reload(): Promise<void> {
  try { await open(targetFromRoute()) }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
}

onBeforeMount(async () => {
  try { await open(targetFromRoute(), true) }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
})

onBeforeRouteUpdate(async (to) => {
  try { await open(targetFromRoute(to)) }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
})

onBeforeUnmount(() => { void EndgePreview.reset() })

function isPreviewEntityType(value: string): value is EndgePreviewEntityType {
  return value === 'project' || value === 'composition' || value === 'component-sfc' || value === 'store'
}
</script>

<template>
  <Teleport to="[data-target='grid-layout-header-tenant']" defer>
    <TenantSwitcher />
  </Teleport>
  <Teleport to="[data-target='grid-layout-header-project']" defer>
    <ProjectSwitcher />
  </Teleport>
  <Teleport to="[data-target='grid-layout-header-environment']" defer>
    <EnvironmentSwitcher />
  </Teleport>
  <Teleport to="[data-target='grid-layout-header-locale']" defer>
    <LocaleSwitcher />
  </Teleport>
  <Teleport to="[data-target='grid-layout-header-theme']" defer>
    <ThemeSwitcher />
  </Teleport>

  <Teleport to="[data-target='grid-layout-header-menu']" defer>
    <button
      type="button"
      class="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      @click="router.push('/')"
    >
      <ArrowLeft class="size-3.5" />
      Конфигуратор
    </button>
  </Teleport>

  <Teleport to="[data-target='grid-layout-header-actions']" defer>
    <Button variant="ghost" size="icon" title="Перезапустить preview" :disabled="loading" @click="reload">
      <RefreshCw class="size-4" :class="loading && 'animate-spin'" />
    </Button>
  </Teleport>

  <div class="h-full min-h-0">
    <div v-if="error" class="flex h-full items-center justify-center p-8">
      <div class="max-w-xl rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
        {{ error }}
      </div>
    </div>
    <EntityPreview v-else />
  </div>
</template>
