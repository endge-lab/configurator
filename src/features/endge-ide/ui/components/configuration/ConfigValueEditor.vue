<script setup lang="ts">
import type { ComponentSFCInteractionTrigger, EndgeJSONValue, TypeProgramCatalogEntry, TypeSourceExpression } from '@endge/core'

import { Endge, inferConfigurationDefault, validateConfigurationValue } from '@endge/core'
import { Plus, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { resolveConfigValueEditor } from '@/features/endge-ide/model/config/ConfigValueEditorRegistry'

import ConfigurationJSONEditor from './ConfigurationJSONEditor.vue'
import SFCEditingTriggerListEditor from './SFCEditingTriggerListEditor.vue'

const props = defineProps<{
  modelValue: EndgeJSONValue
  type: TypeSourceExpression
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  catalog?: readonly TypeProgramCatalogEntry[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: EndgeJSONValue] }>()
const catalog = computed(() => props.catalog ?? Endge.configurationSchema.typeCatalog)
const registeredType = computed(() => {
  const type = props.type
  return type.kind === 'reference' ? catalog.value.find(item => item.identity === type.identity) : undefined
})
const effectiveType = computed<TypeSourceExpression>(() => registeredType.value?.definition ?? props.type)
const kind = computed(() => resolveConfigValueEditor(effectiveType.value))
const enumValues = computed(() => effectiveType.value.kind === 'enum' ? effectiveType.value.values : [])
const objectFields = computed(() => effectiveType.value.kind === 'object' ? effectiveType.value.fields : [])
const arrayItemType = computed(() => effectiveType.value.kind === 'array' ? effectiveType.value.items : { kind: 'reference' as const, identity: 'Any' })
const unionVariants = computed(() => effectiveType.value.kind === 'union' ? effectiveType.value.variants : [])
const recordValueType = computed(() => effectiveType.value.kind === 'record' ? effectiveType.value.values : { kind: 'reference' as const, identity: 'Any' })
const unionIndex = computed(() => Math.max(0, unionVariants.value.findIndex(variant => validateConfigurationValue(variant, props.modelValue, catalog.value).ok)))
const referenceType = computed(() => registeredType.value?.category === 'reference' ? registeredType.value : null)
const referenceOptions = computed(() => {
  const target = referenceType.value?.entityReference?.target
  if (!target) return []
  const plain = Endge.domain.toPlain() as unknown as Record<string, unknown>
  const normalized = target.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
  const candidates = [target, normalized, `${normalized}s`, `${normalized.replace(/-/g, '')}s`]
  const collection = candidates.map(key => plain[key]).find(Array.isArray) as Array<Record<string, unknown>> | undefined
  return (collection ?? []).map(item => ({
    value: String(item.identity ?? item.id ?? ''),
    label: String(item.displayName ?? item.name ?? item.identity ?? item.id ?? ''),
  })).filter(item => item.value)
})
function emitText(value: unknown): void { emit('update:modelValue', String(value ?? '')) }
function emitNumber(value: unknown): void { emit('update:modelValue', Number(value)) }
function triggerValue(): ComponentSFCInteractionTrigger[] { return props.modelValue as unknown as ComponentSFCInteractionTrigger[] }
function emitTriggers(value: ComponentSFCInteractionTrigger[]): void { emit('update:modelValue', JSON.parse(JSON.stringify(value)) as EndgeJSONValue) }
function objectValue(): Record<string, EndgeJSONValue> { return props.modelValue && typeof props.modelValue === 'object' && !Array.isArray(props.modelValue) ? props.modelValue : {} }
function arrayValue(): EndgeJSONValue[] { return Array.isArray(props.modelValue) ? props.modelValue : [] }
function updateObjectField(key: string, value: EndgeJSONValue): void { emit('update:modelValue', { ...objectValue(), [key]: value }) }
function updateArrayItem(index: number, value: EndgeJSONValue): void { const next = [...arrayValue()]; next[index] = value; emit('update:modelValue', next) }
function addArrayItem(): void {
  const inferred = inferConfigurationDefault(arrayItemType.value, catalog.value)
  emit('update:modelValue', [...arrayValue(), inferred.ok ? inferred.value : null])
}
function removeArrayItem(index: number): void { emit('update:modelValue', arrayValue().filter((_, itemIndex) => itemIndex !== index)) }
function addRecordEntry(): void {
  const current = objectValue()
  let index = Object.keys(current).length + 1
  while (`key${index}` in current) index++
  const inferred = inferConfigurationDefault(recordValueType.value, catalog.value)
  emit('update:modelValue', { ...current, [`key${index}`]: inferred.ok ? inferred.value : null })
}
function renameRecordEntry(previous: string, nextRaw: unknown): void {
  const next = String(nextRaw ?? '').trim()
  if (!next || next === previous || next in objectValue()) return
  const entries = Object.entries(objectValue()).map(([key, value]) => [key === previous ? next : key, value])
  emit('update:modelValue', Object.fromEntries(entries) as Record<string, EndgeJSONValue>)
}
function renameRecordEntryFromEvent(previous: string, event: Event): void { renameRecordEntry(previous, (event.target as HTMLInputElement | null)?.value) }
function removeRecordEntry(key: string): void { emit('update:modelValue', Object.fromEntries(Object.entries(objectValue()).filter(([item]) => item !== key)) as Record<string, EndgeJSONValue>) }
function selectUnion(index: string): void {
  const variant = unionVariants.value[Number(index)]
  if (!variant) return
  const inferred = inferConfigurationDefault(variant, catalog.value)
  emit('update:modelValue', inferred.ok ? inferred.value : null)
}
function fieldType(field: (typeof objectFields.value)[number]): TypeSourceExpression {
  return field.array ? { kind: 'array', items: field.type } : field.type
}
</script>

<template>
  <Switch v-if="kind === 'boolean'" :checked="Boolean(modelValue)" :disabled="disabled" @update:checked="$emit('update:modelValue', Boolean($event))" />
  <Input v-else-if="kind === 'number'" :model-value="Number(modelValue)" type="number" :min="min" :max="max" :step="step" :disabled="disabled" @update:model-value="emitNumber" />
  <Input v-else-if="kind === 'time'" :model-value="String(modelValue ?? '')" type="time" :disabled="disabled" @update:model-value="emitText" />
  <Input v-else-if="kind === 'datetime'" :model-value="String(modelValue ?? '')" type="datetime-local" :disabled="disabled" @update:model-value="emitText" />
  <Select v-else-if="kind === 'enum'" :model-value="JSON.stringify(modelValue)" :disabled="disabled" @update:model-value="$emit('update:modelValue', JSON.parse(String($event)))">
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent><SelectItem v-for="item in enumValues" :key="JSON.stringify(item)" :value="JSON.stringify(item)">{{ String(item) }}</SelectItem></SelectContent>
  </Select>
  <Select v-else-if="referenceType" :model-value="String(modelValue ?? '')" :disabled="disabled" @update:model-value="emitText">
    <SelectTrigger><SelectValue placeholder="Выберите сущность" /></SelectTrigger>
    <SelectContent><SelectItem v-for="option in referenceOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem></SelectContent>
  </Select>
  <SFCEditingTriggerListEditor v-else-if="kind === 'trigger-set'" :model-value="triggerValue()" kind="generic" :disabled="disabled" @update:model-value="emitTriggers" />
  <div v-else-if="kind === 'array'" class="space-y-2">
    <div v-for="(item, index) in arrayValue()" :key="index" class="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md border p-2">
      <ConfigValueEditor :model-value="item" :type="arrayItemType" :catalog="catalog" :disabled="disabled" @update:model-value="updateArrayItem(index, $event)" />
      <Button type="button" size="icon" variant="ghost" :disabled="disabled" @click="removeArrayItem(index)"><Trash2 class="size-4" /></Button>
    </div>
    <Button type="button" size="sm" variant="outline" :disabled="disabled" @click="addArrayItem"><Plus class="mr-1.5 size-4" />Добавить</Button>
  </div>
  <div v-else-if="kind === 'object'" class="space-y-3 rounded-md border p-3">
    <div v-for="field in objectFields" :key="field.key" class="space-y-1.5">
      <label class="text-xs font-medium">{{ field.key }}<span v-if="field.optional" class="text-muted-foreground"> · optional</span></label>
      <ConfigValueEditor :model-value="objectValue()[field.key] ?? null" :type="fieldType(field)" :catalog="catalog" :disabled="disabled" @update:model-value="updateObjectField(field.key, $event)" />
    </div>
  </div>
  <div v-else-if="kind === 'union'" class="space-y-2">
    <Select :model-value="String(unionIndex)" :disabled="disabled" @update:model-value="selectUnion(String($event))"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="(variant, index) in unionVariants" :key="index" :value="String(index)">Вариант {{ index + 1 }} · {{ variant.kind === 'reference' ? variant.identity : variant.kind }}</SelectItem></SelectContent></Select>
    <ConfigValueEditor v-if="unionVariants[unionIndex]" :model-value="modelValue" :type="unionVariants[unionIndex]!" :catalog="catalog" :disabled="disabled" @update:model-value="$emit('update:modelValue', $event)" />
  </div>
  <div v-else-if="kind === 'record'" class="space-y-2">
    <div v-for="(item, key) in objectValue()" :key="key" class="grid grid-cols-[10rem_minmax(0,1fr)_auto] gap-2 rounded-md border p-2">
      <Input :model-value="key" :disabled="disabled" @change="renameRecordEntryFromEvent(key, $event)" />
      <ConfigValueEditor :model-value="item" :type="recordValueType" :catalog="catalog" :disabled="disabled" @update:model-value="updateObjectField(key, $event)" />
      <Button type="button" size="icon" variant="ghost" :disabled="disabled" @click="removeRecordEntry(key)"><Trash2 class="size-4" /></Button>
    </div>
    <Button type="button" size="sm" variant="outline" :disabled="disabled" @click="addRecordEntry"><Plus class="mr-1.5 size-4" />Добавить поле</Button>
  </div>
  <ConfigurationJSONEditor v-else-if="kind === 'json'" :model-value="modelValue" :disabled="disabled" @update:model-value="$emit('update:modelValue', $event)" />
  <Input v-else :model-value="String(modelValue ?? '')" :disabled="disabled" @update:model-value="emitText" />
</template>
