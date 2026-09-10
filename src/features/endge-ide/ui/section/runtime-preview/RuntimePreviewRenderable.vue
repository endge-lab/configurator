<script setup lang="ts">
import type { SFCRenderInspectionSessionLike } from '@endge/core'
import type { RuntimePreviewRenderable } from '@/features/endge-ide/domain/types/runtime-preview.types'
import type { RuntimeInspectionRenderable } from '@/features/endge-ide/services/runtime-preview/runtime-inspection-renderer'
import EndgeAdapterRoot from '@/features/endge-ide/ui/runtime/EndgeAdapterRoot'
import StoreFieldsPreview from '@/features/endge-ide/ui/section/runtime-preview/StoreFieldsPreview.vue'
import StoreRuntimePreview from '@/features/endge-ide/ui/section/runtime-preview/StoreRuntimePreview.vue'

defineProps<{ item: RuntimePreviewRenderable | RuntimeInspectionRenderable, inspection?: SFCRenderInspectionSessionLike | null }>()
</script>

<template>
  <EndgeAdapterRoot v-if="item.kind === 'filter-view'" root-key="filter-view" :runtime="'runtime' in item ? item.runtime : null" :model="'model' in item ? item.model : undefined" :readonly="'model' in item" />
  <EndgeAdapterRoot v-else-if="item.kind === 'component-sfc'" root-key="sfc-runtime" :host="item.runtime" :input="item.input" :inspection="inspection ?? null" />
  <StoreRuntimePreview v-else-if="item.kind === 'store'" :runtime="item.runtime" />
  <StoreFieldsPreview v-else-if="item.kind === 'store-snapshot'" :fields="item.fields" :value-label="$t('runtimeInspection.snapshotValue')" />
  <p v-else-if="item.kind === 'unavailable'" class="whitespace-pre-wrap p-4 text-xs text-muted-foreground" role="status">
    {{ item.message }}
  </p>
  <div v-else class="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
    {{ $t('uiText.runtimec4740e4c') }} <code>{{ item.runtime.entityIdentity }}</code> {{ $t('uiText.hasRenderableCapabilityButDoesNotHaveASeparatePreviecad8e5d0') }}
  </div>
</template>
