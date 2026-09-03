<script setup lang="ts">
import type { EndgeJSONValue, TypeProgramCatalogEntry } from '@endge/core'

import { useDomainStore } from '@endge/ui-vue'
import { computed } from 'vue'

import {
  getConfigurationReferenceDropKinds,
  getConfigurationReferenceOptions,
  getConfigurationReferenceSectionTypes,
} from '@/features/endge-ide/config/configuration-reference-options'
import DomainEntityDropTarget from '@/features/endge-ide/ui/components/DomainEntityDropTarget.vue'
import SearchableSelect from '@/shared/ui/searchable-select/SearchableSelect.vue'

const props = defineProps<{
  modelValue: EndgeJSONValue
  type: TypeProgramCatalogEntry
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: EndgeJSONValue] }>()
const domainStore = useDomainStore()
const options = computed(() => getConfigurationReferenceOptions(props.type, domainStore as unknown as Record<string, unknown>))
const sectionTypes = computed(() => getConfigurationReferenceSectionTypes(props.type))
const dropKinds = computed(() => getConfigurationReferenceDropKinds(props.type))

function updateValue(value: string | string[] | null): void {
  if (Array.isArray(value)) {
    return
  }
  emit('update:modelValue', value ?? '')
}
</script>

<template>
  <DomainEntityDropTarget
    :accept-section-types="sectionTypes"
    :accept-kinds="dropKinds"
    :value-field="type.entityReference?.storage ?? 'id'"
    @update:model-value="value => $emit('update:modelValue', value)"
  >
    <SearchableSelect
      :model-value="modelValue == null ? null : String(modelValue)"
      :options="options"
      :disabled="disabled"
      placeholder="Выберите сущность"
      trigger-class="w-full h-9"
      @update:model-value="updateValue"
    />
  </DomainEntityDropTarget>
</template>
