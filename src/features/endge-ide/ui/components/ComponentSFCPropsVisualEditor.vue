<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { VisualSchemaTypeOption } from '@/features/endge-ide/model/visual-schema-editor.types'
import type { TypeSourceDocument } from '@endge/core'

import {
  inspectComponentSFCProps,
  patchComponentSFCPropsSource,
} from '@endge/core'
import { Code2 } from 'lucide-vue-next'
import { computed } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import {
  collectComponentSFCPropTypeIdentities,
  componentSFCPropsToVisualDocument,
  visualDocumentToComponentSFCProps,
} from '@/features/endge-ide/model/component-sfc-editor/component-sfc-props-visual'
import VisualSchemaEditor from '@/features/endge-ide/ui/components/VisualSchemaEditor.vue'

const props = defineProps<{
  source: string
  identity: string
  types: VisualSchemaTypeOption[]
  showPreview: boolean
  showExample: boolean
  panelSizes: number[]
}>()

const emit = defineEmits<{
  (event: 'update:source', source: string): void
  (event: 'update:panelSizes', sizes: number[]): void
  (event: 'openSource', offset: number): void
  (event: 'open:type', identity: string): void
}>()

const projection = computed(() => inspectComponentSFCProps(props.source))
const document = computed(() => componentSFCPropsToVisualDocument(projection.value))
const typeOptions = computed<VisualSchemaTypeOption[]>(() => {
  const options = [...props.types]
  const known = new Set(options.map(option => option.identity))
  for (const identity of collectComponentSFCPropTypeIdentities(projection.value)) {
    if (!known.has(identity)) {
      options.push({
        identity,
        label: identity,
        category: 'user',
      })
    }
  }
  return options
})

function updateDocument(nextDocument: TypeSourceDocument): void {
  const result = patchComponentSFCPropsSource(
    props.source,
    visualDocumentToComponentSFCProps(nextDocument),
  )
  if (!result.ok) {
    toast.error(result.message || 'Не удалось обновить defineProps.')
    return
  }
  emit('update:source', result.source)
}

function openSource(): void {
  emit('openSource', projection.value.sourceRange?.start ?? 0)
}
</script>

<template>
  <div class="flex min-h-[420px] flex-col gap-3">
    <div
      v-if="!projection.editable"
      class="flex shrink-0 items-center justify-between gap-3 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2"
    >
      <p class="text-xs text-muted-foreground">
        {{ projection.message }} UI показывает контракт read-only и не создаёт параллельную модель.
      </p>
      <Button size="sm" variant="outline" class="h-7 shrink-0 gap-1.5" @click="openSource">
        <Code2 class="size-3.5" />
        Редактировать в Source
      </Button>
    </div>

    <VisualSchemaEditor
      class="min-h-0 flex-1"
      :document="document"
      :diagnostics="[]"
      :valid="true"
      :readonly="!projection.editable"
      default-type-identity="string"
      :identity="identity"
      :types="typeOptions"
      :show-preview="showPreview"
      :show-example="showExample"
      :panel-sizes="panelSizes"
      @update:document="updateDocument"
      @update:panel-sizes="sizes => emit('update:panelSizes', sizes)"
      @open:type="typeIdentity => emit('open:type', typeIdentity)"
    />
  </div>
</template>
