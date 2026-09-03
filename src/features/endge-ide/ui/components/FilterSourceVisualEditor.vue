<script setup lang="ts">
import type {
  FilterSourceEditorDocument,
  FilterSourceEditorField,
  FilterSourcePatchOperation,
  SourceFieldOption,
} from '@endge/core'

import { Endge } from '@endge/core'
import {
  ArrowDown,
  ArrowUp,
  Braces,
  FileCode2,
  GripVertical,
  ListFilter,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { SearchableSelect } from '@/shared/ui/searchable-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'

const props = defineProps<{
  source: string
  identity: string
}>()

const emit = defineEmits<{
  (event: 'update:source', source: string): void
  (event: 'openSource', offset: number): void
}>()

type FieldChoiceMode = 'plain' | 'options' | 'vocab'

interface FieldDraft {
  key: string
  type: string
  optional: boolean
  array: boolean
  defaultSource: string
  choiceMode: FieldChoiceMode
  options: SourceFieldOption[]
  vocabIdentity: string
  valuePath: string
  labelPath: string
}

const parsed = computed(() =>
  Endge.source.parse<FilterSourceEditorDocument>('filter', props.source),
)
const document = computed(() => parsed.value.document ?? null)
const fields = computed(() => document.value?.fields ?? [])
const outputs = computed(() => document.value?.outputs ?? [])
const selectedKey = ref<string | null>(null)
const fieldDraft = ref<FieldDraft | null>(null)
const pendingRemovalKey = ref<string | null>(null)
const dragFieldKey = ref<string | null>(null)
const dragOverKey = ref<string | null>(null)

const selectedField = computed(() => {
  const key = selectedKey.value
  return key ? fields.value.find(field => field.key === key) ?? null : null
})

const typeOptions = computed(() => {
  const primitive = ['String', 'Number', 'Boolean', 'Date', 'Time', 'DateTime', 'Object', 'Any']
    .map(identity => ({ value: identity, label: identity, group: 'Primitive' }))
  const registered = Endge.domain.getTypes()
    .filter(type => Boolean(type.identity?.trim()))
    .map(type => ({
      value: type.identity,
      label: type.displayName || type.name || type.identity,
      group: type.isPrimitive ? 'Primitive' : 'Domain',
    }))
  return [...new Map([...primitive, ...registered].map(option => [option.value, option])).values()]
})

const vocabOptions = computed(() => Endge.domain.getVocabs()
  .filter(vocab => vocab.active !== false && Boolean(vocab.identity?.trim()))
  .map(vocab => ({
    value: vocab.identity,
    label: vocab.displayName || vocab.name || vocab.identity,
  })))

watch(
  fields,
  (nextFields) => {
    if (!nextFields.length) {
      selectedKey.value = null
      return
    }
    if (!selectedKey.value || !nextFields.some(field => field.key === selectedKey.value)) {
      selectedKey.value = nextFields[0]?.key ?? null
    }
  },
  { immediate: true },
)

watch(
  selectedField,
  (field) => {
    fieldDraft.value = field ? createFieldDraft(field) : null
  },
  { immediate: true },
)

function createFieldDraft(field: FilterSourceEditorField): FieldDraft {
  return {
    key: field.key,
    type: field.type,
    optional: field.optional,
    array: field.array,
    defaultSource: field.defaultSource ?? '',
    choiceMode: field.vocab ? 'vocab' : field.options ? 'options' : 'plain',
    options: (field.options ?? []).map(option => ({ ...option })),
    vocabIdentity: field.vocab?.identity ?? '',
    valuePath: field.vocab?.valuePath ?? 'id',
    labelPath: field.vocab?.labelPath ?? 'displayName',
  }
}

function applyPatch(operation: FilterSourcePatchOperation): boolean {
  const result = Endge.source.patch<FilterSourcePatchOperation, FilterSourceEditorDocument>(
    'filter',
    props.source,
    operation,
  )
  if (!result.ok) {
    toast.error('Не удалось изменить Filter source', {
      description: result.message,
    })
    return false
  }
  if (result.changed) {
    emit('update:source', result.source)
  }
  return true
}

function updateField(patch: Partial<FieldDraft>): void {
  const current = fieldDraft.value
  const field = selectedField.value
  if (!current || !field) {
    return
  }
  const next = { ...current, ...patch }
  if (applyPatch({
    type: 'set-field',
    key: field.key,
    expression: serializeFieldExpression(next),
  })) {
    fieldDraft.value = next
  }
  else {
    fieldDraft.value = createFieldDraft(field)
  }
}

function serializeFieldExpression(field: FieldDraft): string {
  const lines = [`field(${JSON.stringify(field.type)})`]
  if (field.optional) {
    lines.push('.optional()')
  }
  if (field.array) {
    lines.push('.array()')
  }
  if (field.defaultSource.trim()) {
    lines.push(`.default(${field.defaultSource.trim()})`)
  }
  if (field.choiceMode === 'options') {
    lines.push(`.options(${serializeOptions(field.options)})`)
  }
  if (field.choiceMode === 'vocab') {
    lines.push(
      `.vocab(${JSON.stringify(field.vocabIdentity)}, { valuePath: ${JSON.stringify(field.valuePath)}, labelPath: ${JSON.stringify(field.labelPath)} })`,
    )
  }
  return lines.join('\n      ')
}

function serializeOptions(options: SourceFieldOption[]): string {
  if (!options.length) {
    return '[]'
  }
  return `[${options.map((option) => {
    const label = option.label?.trim()
    return label
      ? `{ value: ${JSON.stringify(option.value)}, label: ${JSON.stringify(label)} }`
      : `{ value: ${JSON.stringify(option.value)} }`
  }).join(', ')}]`
}

function addField(): void {
  const existing = new Set(fields.value.map(field => field.key))
  let index = fields.value.length + 1
  let key = `field_${index}`
  while (existing.has(key)) {
    index += 1
    key = `field_${index}`
  }
  if (applyPatch({
    type: 'add-field',
    key,
    expression: `field('String').optional()`,
  })) {
    selectedKey.value = key
  }
}

function commitFieldKey(): void {
  const draft = fieldDraft.value
  const field = selectedField.value
  if (!draft || !field) {
    return
  }
  const nextKey = draft.key.trim()
  if (!nextKey || nextKey === field.key) {
    draft.key = field.key
    return
  }
  if (applyPatch({ type: 'rename-field', key: field.key, nextKey })) {
    selectedKey.value = nextKey
  }
  else {
    draft.key = field.key
  }
}

function requestRemoveField(key: string): void {
  pendingRemovalKey.value = key
}

function removeField(): void {
  const key = pendingRemovalKey.value
  if (!key) {
    return
  }
  const currentIndex = fields.value.findIndex(field => field.key === key)
  if (applyPatch({ type: 'remove-field', key })) {
    const remaining = fields.value.filter(field => field.key !== key)
    selectedKey.value = remaining[Math.min(currentIndex, remaining.length - 1)]?.key ?? null
    pendingRemovalKey.value = null
  }
}

function moveField(key: string, toIndex: number): void {
  applyPatch({ type: 'move-field', key, toIndex })
}

function onDragStart(event: DragEvent, key: string): void {
  dragFieldKey.value = key
  dragOverKey.value = key
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', key)
  }
}

function onDragOver(event: DragEvent, key: string): void {
  event.preventDefault()
  dragOverKey.value = key
}

function onDrop(event: DragEvent, key: string): void {
  event.preventDefault()
  const fromKey = dragFieldKey.value
  const toIndex = fields.value.findIndex(field => field.key === key)
  if (fromKey && toIndex >= 0) {
    moveField(fromKey, toIndex)
  }
  dragFieldKey.value = null
  dragOverKey.value = null
}

function updateChoiceMode(value: unknown): void {
  const mode = String(value ?? 'plain') as FieldChoiceMode
  if (mode !== 'vocab') {
    updateField({ choiceMode: mode })
    return
  }
  const identity = fieldDraft.value?.vocabIdentity || vocabOptions.value[0]?.value
  if (!identity) {
    toast.info('В домене нет доступных vocab')
    return
  }
  updateField({ choiceMode: mode, vocabIdentity: identity })
}

function updateType(value: string | string[] | null): void {
  if (typeof value === 'string' && value.trim()) {
    updateField({ type: value })
  }
}

function updateVocab(value: string | string[] | null): void {
  if (typeof value === 'string') {
    updateField({ vocabIdentity: value })
  }
}

function addOption(): void {
  const draft = fieldDraft.value
  if (!draft) {
    return
  }
  updateField({ options: [...draft.options, { value: '' }] })
}

function removeOption(index: number): void {
  const draft = fieldDraft.value
  if (!draft) {
    return
  }
  updateField({ options: draft.options.filter((_, optionIndex) => optionIndex !== index) })
}

function updateOption(index: number, key: 'value' | 'label', value: string): void {
  const draft = fieldDraft.value
  if (!draft) {
    return
  }
  const options = draft.options.map((option, optionIndex) => {
    if (optionIndex !== index) {
      return option
    }
    return key === 'label'
      ? { ...option, label: value }
      : { ...option, value }
  })
  fieldDraft.value = { ...draft, options }
}

function commitOptions(): void {
  if (fieldDraft.value) {
    updateField({ options: fieldDraft.value.options })
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-editor-surface">
    <div
      v-if="!document"
      class="grid h-full place-items-center p-8"
    >
      <Card class="max-w-lg p-6 text-center">
        <FileCode2 class="mx-auto mb-3 size-8 text-muted-foreground" />
        <div class="font-medium">
          {{ $t('uiText.sourceIsTemporarilyUnavailableForVisualEditingd0bb6769') }}
        </div>
        <p class="mt-2 text-sm text-muted-foreground">
          {{ $t('uiText.fixTheDiagnosticsInTheSourceTabTheVisualEditorWillNo88881918') }}
        </p>
        <Button class="mt-4" variant="outline" @click="emit('openSource', 0)">
          {{ $t('uiText.openSource4dda88e1') }}
        </Button>
      </Card>
    </div>

    <template v-else>
      <div class="flex shrink-0 items-center gap-3 border-b px-4 py-2.5">
        <div class="flex size-8 items-center justify-center rounded-md bg-primary/10">
          <ListFilter class="size-4 text-primary" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium">
            {{ $t('uiText.filterFieldsf69019f7') }}
          </div>
          <div class="truncate text-xs text-muted-foreground">
            {{ identity }} {{ $t('uiText.sourceBackedVisualEditor616d8cee') }}
          </div>
        </div>
        <Badge variant="secondary">
          {{ fields.length }} {{ $t('uiText.fields97c557fb') }}
        </Badge>
        <Button size="sm" class="gap-1.5" @click="addField">
          <Plus class="size-3.5" />
          {{ $t('uiText.fieldc52083fa') }}
        </Button>
      </div>

      <div class="grid min-h-0 flex-1 grid-cols-[minmax(15rem,0.7fr)_minmax(22rem,1.3fr)]">
        <div class="flex min-h-0 flex-col border-r">
          <ScrollArea class="min-h-0 flex-1">
            <div class="space-y-1 p-2">
              <button
                v-for="(field, index) in fields"
                :key="field.key"
                type="button"
                draggable="true"
                class="group flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left transition-colors"
                :class="[
                  selectedKey === field.key
                    ? 'border-primary/40 bg-primary/8'
                    : 'border-transparent hover:border-border hover:bg-muted/50',
                  dragOverKey === field.key && dragFieldKey !== field.key
                    ? 'ring-1 ring-primary'
                    : '',
                ]"
                @click="selectedKey = field.key"
                @dragstart="onDragStart($event, field.key)"
                @dragover="onDragOver($event, field.key)"
                @drop="onDrop($event, field.key)"
                @dragend="dragFieldKey = null; dragOverKey = null"
              >
                <GripVertical class="size-3.5 shrink-0 cursor-grab text-muted-foreground/60" />
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium">
                    {{ field.key }}
                  </div>
                  <div class="truncate text-xs text-muted-foreground">
                    {{ field.type }}{{ field.array ? $t('uiText.symbol97d170e1') : undefined }}
                    <template v-if="field.vocab">
                      {{ $t('uiText.vocab6b8ba48f') }}
                    </template>
                    <template v-else-if="field.options">
                      {{ $t('uiText.options4c9843da') }}
                    </template>
                  </div>
                </div>
                <div class="hidden items-center gap-0.5 group-hover:flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-7"
                    :disabled="index === 0"
                    aria-label="Переместить выше"
                    @click.stop="moveField(field.key, index - 1)"
                  >
                    <ArrowUp class="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-7"
                    :disabled="index === fields.length - 1"
                    aria-label="Переместить ниже"
                    @click.stop="moveField(field.key, index + 1)"
                  >
                    <ArrowDown class="size-3.5" />
                  </Button>
                </div>
              </button>

              <div
                v-if="!fields.length"
                class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"
              >
                {{ $t('uiText.noFieldsArePresentInTheSourceYet582ce9a2') }}
              </div>
            </div>
          </ScrollArea>

          <Separator />

          <div class="shrink-0 p-2">
            <div class="mb-1 flex items-center gap-2 px-2 py-1">
              <Braces class="size-3.5 text-muted-foreground" />
              <span class="text-xs font-medium">{{ $t('uiText.outputs7835db44') }}</span>
              <Badge variant="outline" class="ml-auto h-5 px-1.5 text-[10px]">
                {{ outputs.length }}
              </Badge>
            </div>
            <button
              v-for="output in outputs"
              :key="output.key"
              type="button"
              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50"
              @click="emit('openSource', output.sourceRange.start)"
            >
              <span class="min-w-0 flex-1 truncate text-xs">{{ output.key }}</span>
              <Badge variant="secondary" class="h-5 text-[10px]">
                {{ output.kind }}
              </Badge>
              <FileCode2 class="size-3 text-muted-foreground" />
            </button>
          </div>
        </div>

        <ScrollArea class="min-h-0">
          <div v-if="fieldDraft && selectedField" class="mx-auto max-w-3xl space-y-6 p-5">
            <div class="flex items-start gap-3">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <Settings2 class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-medium">
                  {{ $t('uiText.fieldConfiguration3bba10fe') }}
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ $t('uiText.allChangesAreWrittenDirectlyToDefineFilterFieldsf34d03f9') }}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                class="size-8 text-destructive hover:text-destructive"
                aria-label="Удалить поле"
                @click="requestRemoveField(selectedField.key)"
              >
                <Trash2 class="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                class="size-8"
                aria-label="Открыть поле в Source"
                @click="emit('openSource', selectedField.sourceRange.start)"
              >
                <FileCode2 class="size-4" />
              </Button>
            </div>

            <Card class="space-y-4 p-4">
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="space-y-2">
                  <Label>{{ $t('uiText.keyc67dd20e') }}</Label>
                  <Input
                    v-model="fieldDraft.key"
                    autocomplete="off"
                    @blur="commitFieldKey"
                    @keydown.enter.prevent="commitFieldKey"
                  />
                </div>
                <div class="space-y-2">
                  <Label>{{ $t('uiText.type3deb7456') }}</Label>
                  <SearchableSelect
                    :model-value="fieldDraft.type"
                    :options="typeOptions"
                    placeholder="Выберите тип"
                    @update:model-value="updateType"
                  />
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-6">
                <Label class="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    :model-value="fieldDraft.optional"
                    @update:model-value="updateField({ optional: $event === true })"
                  />
                  {{ $t('uiText.optional0c6c4102') }}
                </Label>
                <Label class="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    :model-value="fieldDraft.array"
                    @update:model-value="updateField({ array: $event === true })"
                  />
                  {{ $t('uiText.array10700447') }}
                </Label>
              </div>
            </Card>

            <Card class="space-y-4 p-4">
              <div>
                <div class="text-sm font-medium">
                  {{ $t('uiText.defaultValueA027b1fa') }}
                </div>
                <div class="mt-0.5 text-xs text-muted-foreground">
                  {{ $t('uiText.specifySourceExpressionStringNumberRelativeDateOrAno31b19646') }}
                </div>
              </div>
              <Input
                v-model="fieldDraft.defaultSource"
                class="font-mono text-xs"
                placeholder="Без default"
                @blur="updateField({ defaultSource: fieldDraft.defaultSource })"
                @keydown.enter.prevent="updateField({ defaultSource: fieldDraft.defaultSource })"
              />
            </Card>

            <Card class="space-y-4 p-4">
              <div class="grid items-end gap-4 sm:grid-cols-[12rem_1fr]">
                <div class="space-y-2">
                  <Label>{{ $t('uiText.optionsSourceb0520549') }}</Label>
                  <Select
                    :model-value="fieldDraft.choiceMode"
                    @update:model-value="updateChoiceMode"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plain">
                        {{ $t('uiText.noOptions5542a713') }}
                      </SelectItem>
                      <SelectItem value="options">
                        {{ $t('uiText.staticList4a86d3c0') }}
                      </SelectItem>
                      <SelectItem value="vocab">
                        {{ $t('uiText.vocab239c2f13') }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ $t('uiText.selectWillBeAutomaticallyChosenAtRuntimeForOptionsOr239008e7') }}
                </div>
              </div>

              <template v-if="fieldDraft.choiceMode === 'options'">
                <Separator />
                <div class="space-y-2">
                  <div
                    v-for="(option, index) in fieldDraft.options"
                    :key="index"
                    class="grid grid-cols-[1fr_1fr_auto] gap-2"
                  >
                    <Input
                      :model-value="String(option.value)"
                      placeholder="Value"
                      @update:model-value="updateOption(index, 'value', String($event ?? ''))"
                      @blur="commitOptions"
                    />
                    <Input
                      :model-value="option.label ?? ''"
                      placeholder="Label"
                      @update:model-value="updateOption(index, 'label', String($event ?? ''))"
                      @blur="commitOptions"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Удалить option"
                      @click="removeOption(index)"
                    >
                      <Trash2 class="size-4" />
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" class="gap-1.5" @click="addOption">
                    <Plus class="size-3.5" />
                    {{ $t('uiText.option794e06ab') }}
                  </Button>
                </div>
              </template>

              <template v-else-if="fieldDraft.choiceMode === 'vocab'">
                <Separator />
                <div class="space-y-2">
                  <Label>{{ $t('uiText.vocab239c2f13') }}</Label>
                  <SearchableSelect
                    :model-value="fieldDraft.vocabIdentity"
                    :options="vocabOptions"
                    placeholder="Выберите vocab"
                    @update:model-value="updateVocab"
                  />
                </div>
                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="space-y-2">
                    <Label>{{ $t('uiText.valuePathf284cabf') }}</Label>
                    <Input
                      v-model="fieldDraft.valuePath"
                      @blur="updateField({ valuePath: fieldDraft.valuePath })"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label>{{ $t('uiText.labelPathb7d45e5e') }}</Label>
                    <Input
                      v-model="fieldDraft.labelPath"
                      @blur="updateField({ labelPath: fieldDraft.labelPath })"
                    />
                  </div>
                </div>
              </template>
            </Card>
          </div>

          <div v-else class="grid min-h-72 place-items-center p-8 text-sm text-muted-foreground">
            {{ $t('uiText.selectAFieldFromTheLeftOrAddANewOne89d5eb93') }}
          </div>
        </ScrollArea>
      </div>
    </template>

    <AlertDialog :open="pendingRemovalKey != null" @update:open="open => { if (!open) pendingRemovalKey = null }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ $t('uiText.deleteFieldeba675fa') }} {{ pendingRemovalKey }}{{ $t('uiText.symbol5bab61eb') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t('uiText.theFieldWillBeRemovedFromTheSourceLocalValueReferenc78b4fc56') }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="pendingRemovalKey = null">
            {{ $t('uiText.cancel0ec753be') }}
          </AlertDialogCancel>
          <AlertDialogAction @click="removeField">
            {{ $t('uiText.delete86ea33ae') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
