<script setup lang="ts">
import type { ConfigurationSourceValueDefinition, EndgeJSONValue, TypeSourceExpression } from '@endge/core'
import type { RConfigurationEditor } from '@/features/endge-ide/domain/entities/RConfigurationEditor'

import { Endge, inferConfigurationDefault, validateConfigurationValue } from '@endge/core'
import { Brackets, Code2, Eye, Loader2, Plus, Save, Settings2, Trash2, TriangleAlert } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import { createEditorDiagnosticsEntityRef } from '@/features/endge-ide/services/diagnostics/editor-diagnostics-entity-ref'
import ConfigValueEditor from '@/features/endge-ide/ui/components/configuration/ConfigValueEditor.vue'
import ConfigurationSourceEditor from '@/features/endge-ide/ui/components/ConfigurationSourceEditor.vue'
import EntityProblemsPanel from '@/features/endge-ide/ui/components/diagnostics/EntityProblemsPanel.vue'
import DocumentGeneralSettingsPanel from '@/features/endge-ide/ui/components/DocumentGeneralSettingsPanel.vue'
import DocumentIdentityInput from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdentityInput.vue'
import DocumentIdField from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdField.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import SourceFormatButton from '@/features/endge-ide/ui/components/source-document-editor/SourceFormatButton.vue'
import TypeRegistrySelect from '@/features/endge-ide/ui/components/TypeRegistrySelect.vue'
import { useSmartTabSelection } from '@/features/endge-ide/ui/smart-tabs'

const props = defineProps<{ tabContext?: { editor?: RConfigurationEditor } }>()
const { t } = useI18n()
const editor = computed(() => props.tabContext?.editor ?? null)
const activeTab = useSmartTabSelection('editor.configuration.active-tab', 'visual', ['general', 'visual', 'source', 'diagnostics'] as const)
const diagnosticsEntityRef = computed(() => createEditorDiagnosticsEntityRef('configuration', editor.value))
const sourceEditorRef = ref<{ formatDocument: () => Promise<void> } | null>(null)
const pendingArrayChange = ref<{ key: string, kind: 'keepFirst' | 'clearNumberConstraints' } | null>(null)
const configurationInlineTypeOptions = [
  { value: 'enum', label: 'Enum', group: 'Inline-типы' },
]
const enumValueKindOptions = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
] as const
type EnumValue = string | number | boolean
type EnumValueKind = typeof enumValueKindOptions[number]['value']

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
function applySource(value: string): void {
  editor.value?.applySourceText(value)
}
function updateValue(value: ConfigurationSourceValueDefinition, patch: Partial<ConfigurationSourceValueDefinition>): void {
  editor.value?.updateValue({ ...clone(value), ...patch, defaultWasInferred: false })
}
function updateDefault(value: ConfigurationSourceValueDefinition, defaultValue: EndgeJSONValue): void {
  updateValue(value, { defaultValue })
}
function editableType(value: ConfigurationSourceValueDefinition): TypeSourceExpression {
  return value.type.kind === 'array' ? value.type.items : value.type
}
function selectedType(value: ConfigurationSourceValueDefinition): string {
  const type = editableType(value)
  return type.kind === 'reference' ? type.identity : type.kind
}
function replaceType(value: ConfigurationSourceValueDefinition, type: TypeSourceExpression, defaultValue: EndgeJSONValue): void {
  updateValue(value, {
    type,
    defaultValue,
    min: undefined,
    max: undefined,
    step: undefined,
  })
}
function updateType(value: ConfigurationSourceValueDefinition, identity: string): void {
  if (!identity || identity === selectedType(value)) {
    return
  }
  const catalog = Endge.configurationSchema.typeCatalog
  const itemType: TypeSourceExpression = identity === 'enum'
    ? { kind: 'enum', values: ['value'] }
    : { kind: 'reference', identity }
  if (value.type.kind === 'array') {
    const type = { kind: 'array' as const, items: itemType }
    const defaultValue = validateConfigurationValue(type, value.defaultValue, catalog).ok ? value.defaultValue : []
    replaceType(value, type, defaultValue)
    return
  }
  const inferred = inferConfigurationDefault(itemType, catalog)
  if (inferred.ok) {
    replaceType(value, itemType, inferred.value)
    return
  }
  const registeredType = catalog.find(item => item.identity === identity)
  if (registeredType?.category === 'reference') {
    const current = value.defaultValue
    const acceptsCurrent = registeredType.entityReference?.storage === 'identity'
      ? typeof current === 'string'
      : typeof current === 'string' || typeof current === 'number'
    replaceType(value, itemType, acceptsCurrent ? current : '')
    return
  }
  replaceType(value, itemType, null)
}
function applyArrayToggle(value: ConfigurationSourceValueDefinition): void {
  if (value.type.kind !== 'array') {
    const emptyString = selectedType(value) === 'String' && value.defaultValue === ''
    replaceType(value, { kind: 'array', items: value.type }, emptyString ? [] : [value.defaultValue])
    return
  }
  const items = Array.isArray(value.defaultValue) ? value.defaultValue : []
  if (items.length) {
    replaceType(value, value.type.items, items[0]!)
    return
  }
  const inferred = inferConfigurationDefault(value.type.items, Endge.configurationSchema.typeCatalog)
  if (inferred.ok) {
    replaceType(value, value.type.items, inferred.value)
  }
  else {
    toast.warning(t('configurationEditor.arrayScalarDefaultRequired'))
  }
}
function requestArrayToggle(value: ConfigurationSourceValueDefinition): void {
  if (value.type.kind === 'array') {
    if (Array.isArray(value.defaultValue) && value.defaultValue.length > 1) {
      pendingArrayChange.value = { key: value.key, kind: 'keepFirst' }
      return
    }
  }
  else if (value.min !== undefined || value.max !== undefined || value.step !== undefined) {
    pendingArrayChange.value = { key: value.key, kind: 'clearNumberConstraints' }
    return
  }
  applyArrayToggle(value)
}
function confirmArrayToggle(): void {
  const pending = pendingArrayChange.value
  const value = editor.value?.values.find(value => value.key === pending?.key)
  if (value) {
    applyArrayToggle(value)
  }
  pendingArrayChange.value = null
}
function editableEnum(value: ConfigurationSourceValueDefinition) {
  const type = editableType(value)
  return type.kind === 'enum' ? type : null
}
function fieldSettingsLabel(value: ConfigurationSourceValueDefinition): string {
  return editableEnum(value)
    ? t('configurationEditor.allowedValues', { key: value.key })
    : t('configurationEditor.fieldSettings', { key: value.key })
}
function enumValueKind(value: ConfigurationSourceValueDefinition): EnumValueKind {
  const first = editableEnum(value)?.values[0]
  if (typeof first === 'number') {
    return 'number'
  }
  if (typeof first === 'boolean') {
    return 'boolean'
  }
  return 'string'
}
function updateEnumValues(value: ConfigurationSourceValueDefinition, values: EnumValue[], previous: EndgeJSONValue = value.defaultValue): void {
  if (!values.length) {
    return
  }
  const type = { kind: 'enum' as const, values }
  const isAllowed = (item: EndgeJSONValue) => values.some(allowed => Object.is(allowed, item))
  if (value.type.kind === 'array') {
    const items = Array.isArray(previous) ? previous : []
    replaceType(value, { kind: 'array', items: type }, items.filter(isAllowed))
  }
  else {
    replaceType(value, type, isAllowed(previous) ? previous : values[0]!)
  }
}
function updateEnumValueKind(value: ConfigurationSourceValueDefinition, kind: EnumValueKind): void {
  updateEnumValues(value, kind === 'number'
    ? [0]
    : kind === 'boolean'
      ? [true, false]
      : ['value'])
}
function updateEnumValue(value: ConfigurationSourceValueDefinition, index: number, rawValue: unknown): void {
  const type = editableEnum(value)
  if (!type) {
    return
  }
  const values = [...type.values]
  const kind = enumValueKind(value)
  if (kind === 'number') {
    const numberValue = Number(rawValue)
    if (!Number.isFinite(numberValue)) {
      return
    }
    values[index] = numberValue
  }
  else if (kind === 'boolean') {
    values[index] = String(rawValue) === 'true'
  }
  else {
    values[index] = String(rawValue ?? '')
  }
  const replaceItem = (item: EndgeJSONValue) => Object.is(item, type.values[index]) ? values[index]! : item
  const previous = value.defaultValue
  updateEnumValues(value, values, Array.isArray(previous) ? previous.map(replaceItem) : replaceItem(previous))
}
function canAddEnumValue(value: ConfigurationSourceValueDefinition): boolean {
  const type = editableEnum(value)
  return type != null && (enumValueKind(value) !== 'boolean' || type.values.length < 2)
}
function addEnumValue(value: ConfigurationSourceValueDefinition): void {
  const type = editableEnum(value)
  if (!type || !canAddEnumValue(value)) {
    return
  }
  const values = [...type.values]
  const kind = enumValueKind(value)
  if (kind === 'number') {
    const numbers = values.filter((item): item is number => typeof item === 'number')
    values.push(Math.max(-1, ...numbers) + 1)
  }
  else if (kind === 'boolean') {
    values.push(!values.includes(true))
  }
  else {
    let next = 'value'
    let suffix = 0
    while (values.includes(next)) {
      next = `value${++suffix}`
    }
    values.push(next)
  }
  updateEnumValues(value, values)
}
function removeEnumValue(value: ConfigurationSourceValueDefinition, index: number): void {
  const type = editableEnum(value)
  if (!type || type.values.length <= 1) {
    return
  }
  updateEnumValues(value, type.values.filter((_, itemIndex) => itemIndex !== index))
}
function addValue(): void {
  const values = editor.value?.values ?? []
  let index = 1
  while (values.some(item => item.key === `setting${index}`)) {
    index++
  }
  editor.value?.updateValue({
    key: `setting${index}`,
    type: { kind: 'reference', identity: 'String' },
    defaultValue: '',
    defaultWasInferred: false,
    label: `Настройка ${index}`,
  })
}
function renameValueFromEvent(value: ConfigurationSourceValueDefinition, event: Event): void {
  const input = event.target as HTMLInputElement | null
  const nextKey = String(input?.value ?? '').trim()
  if (!nextKey || nextKey === value.key) {
    if (input) {
      input.value = value.key
    }
    return
  }
  try {
    editor.value?.renameValue(value.key, nextKey)
  }
  catch (error) {
    if (input) {
      input.value = value.key
    }
    toast.error('Key не изменён', { description: error instanceof Error ? error.message : String(error) })
  }
}
function openDiagnostics(): void {
  editor.value?.refreshDiagnostics()
  activeTab.value = 'diagnostics'
}
async function save(): Promise<void> {
  const current = editor.value
  if (!current) {
    return
  }
  current.identity = current.identity.trim()
  current.name = current.name.trim() || current.identity
  current.refreshDiagnostics()
  if (current.diagnostics.length) {
    toast.error('Configuration не сохранена', { description: current.diagnostics[0] })
    return
  }
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <SourceDocumentEditorShell v-if="editor" :document-id="editor.id" :identity="editor.identity" :display-name="editor.name" document-type="configuration" :dependency-source="editor.source" :dependency-draft="editor">
    <template #right>
      <div v-if="activeTab === 'source'" class="flex items-center rounded-md border bg-muted/40 p-0.5">
        <SourceFormatButton @click="sourceEditorRef?.formatDocument()" />
      </div>
    </template>
    <template #center>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button size="icon" variant="ghost" class="h-7 w-7" :class="activeTab === 'general' ? 'bg-editor-control shadow-sm' : 'text-muted-foreground'" @click="activeTab = 'general'">
                <Settings2 class="size-4" />
              </Button>
            </TooltipTrigger><TooltipContent>{{ $t('uiText.basic127492c2') }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button size="icon" variant="ghost" class="h-7 w-7" :class="activeTab === 'visual' ? 'bg-editor-control shadow-sm' : 'text-muted-foreground'" @click="activeTab = 'visual'">
                <Eye class="size-4" />
              </Button>
            </TooltipTrigger><TooltipContent>{{ $t('uiText.visual770d690e') }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button size="icon" variant="ghost" class="h-7 w-7" :class="activeTab === 'source' ? 'bg-editor-control shadow-sm' : 'text-muted-foreground'" @click="activeTab = 'source'">
                <Code2 class="size-4" />
              </Button>
            </TooltipTrigger><TooltipContent>{{ $t('uiText.sourceda13add2') }}</TooltipContent>
          </Tooltip>
        </div>
        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button size="icon" variant="ghost" class="h-7 w-7" aria-label="Сохранить" :disabled="EndgeIDE.busy.value" @click="save">
                <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" /><Save v-else class="size-4" />
              </Button>
            </TooltipTrigger><TooltipContent>{{ $t('uiText.save4864057d') }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button size="icon" variant="ghost" class="h-7 w-7" :class="activeTab === 'diagnostics' ? 'bg-editor-control shadow-sm' : 'text-muted-foreground'" aria-label="Диагностика" @click="openDiagnostics">
                <TriangleAlert class="size-4" />
              </Button>
            </TooltipTrigger><TooltipContent>{{ $t('uiText.diagnosis9ba1e22a') }}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <DocumentGeneralSettingsPanel v-if="activeTab === 'general'">
      <div class="max-w-2xl space-y-5">
        <DocumentIdField :document-id="editor.id" />
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>{{ $t('uiText.categoryNameca2014a9') }}</Label><Input v-model="editor.name" />
          </div><div class="space-y-2">
            <Label>{{ $t('uiText.identity7e5a975b') }}</Label><DocumentIdentityInput v-model="editor.identity" spellcheck="false" />
          </div>
        </div>
        <div class="space-y-2">
          <Label>{{ $t('uiText.descriptionF5441f6a') }}</Label><Textarea v-model="editor.description" :rows="4" />
        </div>
        <div class="space-y-2">
          <Label>{{ $t('uiText.sourceVersionb94adbb6') }}</Label><Input :model-value="1" disabled />
        </div>
      </div>
    </DocumentGeneralSettingsPanel>

    <div v-else-if="activeTab === 'visual'" class="min-h-0 min-w-0 flex-1 space-y-3 overflow-auto p-4">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold">
          {{ $t('uiText.categoryValues41961e86') }}
        </h3>
        <Button size="sm" variant="outline" @click="addValue">
          <Plus class="size-4" />{{ $t('uiText.add559a87f7') }}
        </Button>
      </div>
      <div v-if="!editor.values.length" class="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
        {{ $t('uiText.valuesNotDeclaredbcad8c5b') }}
      </div>
      <div v-else class="overflow-x-auto rounded-md border">
        <table class="w-full min-w-[49rem] table-fixed text-sm" :aria-label="$t('uiText.categoryValues41961e86')">
          <colgroup>
            <col class="w-[18%]">
            <col class="w-[20%]">
            <col class="w-[17%]">
            <col class="w-[22%]">
            <col>
            <col class="w-24">
          </colgroup>
          <thead class="border-b bg-muted/40 text-xs text-muted-foreground [&_th]:px-2 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium">
            <tr>
              <th scope="col">
                {{ $t('uiText.keyc67dd20e') }}
              </th>
              <th scope="col">
                {{ $t('uiText.label4341e3c2') }}
              </th>
              <th scope="col">
                {{ $t('uiText.typeD25691ca') }}
              </th>
              <th scope="col">
                {{ $t('uiText.default808d7dca') }}
              </th>
              <th scope="col">
                {{ $t('uiText.description55f8ebc8') }}
              </th>
              <th scope="col">
                <span class="sr-only">{{ $t('configurationEditor.actions') }}</span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top">
            <tr v-for="value in editor.values" :key="value.key" class="hover:bg-muted/20 focus-within:bg-muted/20">
              <td>
                <Input
                  :model-value="value.key"
                  :aria-label="$t('uiText.keyc67dd20e')"
                  class="px-2 font-mono text-xs"
                  spellcheck="false"
                  @change="renameValueFromEvent(value, $event)"
                />
              </td>
              <td>
                <Input
                  :model-value="value.label"
                  :aria-label="$t('uiText.label4341e3c2')"
                  class="px-2"
                  @update:model-value="updateValue(value, { label: String($event ?? '') })"
                />
              </td>
              <td>
                <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
                  <TypeRegistrySelect
                    :model-value="selectedType(value)"
                    :additional-options="configurationInlineTypeOptions"
                    trigger-class="px-2"
                    @update:model-value="updateType(value, $event)"
                  />
                  <Button
                    type="button"
                    size="icon"
                    :variant="value.type.kind === 'array' ? 'secondary' : 'outline'"
                    class="size-9"
                    :class="{ 'border border-primary/40 text-primary': value.type.kind === 'array' }"
                    :aria-label="$t('configurationEditor.array')"
                    :title="$t('configurationEditor.array')"
                    :aria-pressed="value.type.kind === 'array'"
                    @click="requestArrayToggle(value)"
                  >
                    <Brackets class="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </td>
              <td>
                <ConfigValueEditor
                  :model-value="value.defaultValue"
                  :type="value.type"
                  :min="value.min"
                  :max="value.max"
                  :step="value.step"
                  compact
                  @update:model-value="updateDefault(value, $event)"
                />
              </td>
              <td>
                <Textarea
                  :model-value="value.description ?? ''"
                  :aria-label="$t('uiText.description55f8ebc8')"
                  :rows="1"
                  class="min-h-9 px-2 py-1.5 text-sm leading-5 [field-sizing:content]"
                  @update:model-value="updateValue(value, { description: $event || undefined })"
                />
              </td>
              <td>
                <div class="flex justify-end gap-1">
                  <Dialog v-if="editableEnum(value) || (value.type.kind === 'reference' && value.type.identity === 'Number')">
                    <DialogTrigger as-child>
                      <Button size="icon" variant="ghost" class="text-muted-foreground" :aria-label="fieldSettingsLabel(value)" :title="fieldSettingsLabel(value)">
                        <Settings2 class="size-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent class="max-h-[85dvh] overflow-auto" :aria-describedby="undefined">
                      <DialogHeader>
                        <DialogTitle class="pr-6 break-words">
                          {{ fieldSettingsLabel(value) }}
                        </DialogTitle>
                      </DialogHeader>
                      <template v-if="editableEnum(value)">
                        <div class="flex flex-wrap items-end justify-between gap-3">
                          <div class="space-y-1.5">
                            <Label>{{ $t('uiText.valueTypeEnum40e5a11b') }}</Label>
                            <Select :model-value="enumValueKind(value)" @update:model-value="updateEnumValueKind(value, String($event) as EnumValueKind)">
                              <SelectTrigger class="w-32" :aria-label="$t('uiText.valueTypeEnum40e5a11b')">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem v-for="option in enumValueKindOptions" :key="option.value" :value="option.value">
                                  {{ option.label }}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button size="sm" variant="outline" :disabled="!canAddEnumValue(value)" @click="addEnumValue(value)">
                            <Plus class="size-4" />{{ $t('uiText.addOptionEba2247e') }}
                          </Button>
                        </div>
                        <div class="space-y-2">
                          <div v-for="(item, index) in editableEnum(value)?.values" :key="index" class="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                            <Select v-if="typeof item === 'boolean'" :model-value="String(item)" @update:model-value="updateEnumValue(value, index, $event)">
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="true">
                                  {{ $t('uiText.true5ffe533b') }}
                                </SelectItem>
                                <SelectItem value="false">
                                  {{ $t('uiText.false7cb6efb9') }}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <Input v-else :model-value="String(item)" :type="typeof item === 'number' ? 'number' : 'text'" spellcheck="false" @change="updateEnumValue(value, index, ($event.target as HTMLInputElement).value)" />
                            <Button size="icon" variant="ghost" class="text-muted-foreground hover:text-destructive" :aria-label="$t('uiText.delete86ea33ae')" :disabled="editableEnum(value)?.values.length === 1" @click="removeEnumValue(value, index)">
                              <Trash2 class="size-4" />
                            </Button>
                          </div>
                        </div>
                      </template>
                      <div v-else class="grid grid-cols-3 gap-3">
                        <label class="space-y-1.5 text-sm">
                          <span>{{ $t('uiText.min7eb0cee8') }}</span>
                          <Input :model-value="value.min" type="number" @update:model-value="updateValue(value, { min: $event === '' ? undefined : Number($event) })" />
                        </label>
                        <label class="space-y-1.5 text-sm">
                          <span>{{ $t('uiText.maxa95e85ae') }}</span>
                          <Input :model-value="value.max" type="number" @update:model-value="updateValue(value, { max: $event === '' ? undefined : Number($event) })" />
                        </label>
                        <label class="space-y-1.5 text-sm">
                          <span>{{ $t('uiText.stepdc416e10') }}</span>
                          <Input :model-value="value.step" type="number" @update:model-value="updateValue(value, { step: $event === '' ? undefined : Number($event) })" />
                        </label>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button size="icon" variant="ghost" class="text-muted-foreground hover:text-destructive" :aria-label="$t('configurationEditor.removeField', { key: value.key })" :title="$t('configurationEditor.removeField', { key: value.key })" @click="editor.removeValue(value.key)">
                    <Trash2 class="size-4" />
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <AlertDialog :open="pendingArrayChange !== null" @update:open="open => { if (!open) pendingArrayChange = null }">
        <AlertDialogContent v-if="pendingArrayChange">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {{ pendingArrayChange.kind === 'keepFirst' ? $t('configurationEditor.keepFirstArrayItem') : $t('configurationEditor.clearNumberConstraints') }}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {{ pendingArrayChange.kind === 'keepFirst'
                ? $t('configurationEditor.keepFirstArrayItemDescription', { key: pendingArrayChange.key })
                : $t('configurationEditor.clearNumberConstraintsDescription', { key: pendingArrayChange.key }) }}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{{ $t('uiText.cancel0ec753be') }}</AlertDialogCancel>
            <Button type="button" @click="confirmArrayToggle">
              {{ pendingArrayChange.kind === 'keepFirst' ? $t('configurationEditor.keepFirst') : $t('configurationEditor.makeArray') }}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

    <div v-else-if="activeTab === 'source'" class="min-h-0 flex-1">
      <ConfigurationSourceEditor ref="sourceEditorRef" :model-value="editor.source" :identity="editor.identity" @update:model-value="applySource" />
    </div>
    <EntityProblemsPanel v-else-if="diagnosticsEntityRef" :entity-ref="diagnosticsEntityRef" :authoring-diagnostics="editor.sourceDiagnostics" class="min-h-0 flex-1" />
  </SourceDocumentEditorShell>
</template>
