<script setup lang="ts">
import type { VisualSchemaTypeOption } from '@/features/endge-ide/model/visual-schema-editor.types'

import { computed } from 'vue'

import {
  parseTypeVisualSource,
  serializeTypeSourceDocument,
} from '@/features/endge-ide/model/type-visual-editor'
import VisualSchemaEditor from '@/features/endge-ide/ui/components/VisualSchemaEditor.vue'

const props = defineProps<{
  modelValue: string
  identity: string
  types: VisualSchemaTypeOption[]
  showPreview: boolean
  showExample: boolean
  panelSizes: number[]
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'update:panelSizes', value: number[]): void
  (event: 'open:type', identity: string): void
}>()

const parsed = computed(() => parseTypeVisualSource(props.modelValue))
</script>

<template>
  <VisualSchemaEditor
    :document="parsed.document"
    :diagnostics="parsed.diagnostics"
    :valid="parsed.valid"
    allow-field-descriptions
    :identity="identity"
    :types="types"
    :show-preview="showPreview"
    :show-example="showExample"
    :panel-sizes="panelSizes"
    @update:document="document => emit('update:modelValue', serializeTypeSourceDocument(document))"
    @update:panel-sizes="sizes => emit('update:panelSizes', sizes)"
    @open:type="typeIdentity => emit('open:type', typeIdentity)"
  />
</template>
