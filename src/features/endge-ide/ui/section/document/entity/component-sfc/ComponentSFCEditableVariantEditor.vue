<script setup lang="ts">
import type {
  ComponentSFCTableEditableElementProjection,
  ComponentSFCTableVisualCellTag,
  RComponentContractInput,
} from '@endge/core'
import type {
  TableCellBindingValueKind,
  TableCellComponentOption,
} from '@/features/endge-ide/services/component-sfc-editor/table-cell-binding.types'
import type { SearchableSelectOption } from '@/features/endge-ide/ui/components/searchable-select'

import {
  compileComponentSFCExpression,
  getComponentSFCTagInputContract,
} from '@endge/core'
import { Blocks, ExternalLink, FileCode2, Tags } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { TABLE_CELL_EDITOR_TAGS } from '@/features/endge-ide/services/component-sfc-editor/table-cell-binding.types'
import { SearchableSelect } from '@/features/endge-ide/ui/components/searchable-select'

interface BindingField extends RComponentContractInput {
  sourceOnly?: boolean
}

const props = defineProps<{
  editor: ComponentSFCTableEditableElementProjection | null
  implicit: boolean
  selecting?: boolean
  componentOptions: TableCellComponentOption[]
}>()

const emit = defineEmits<{
  (event: 'setComponent', identity: string): void
  (event: 'setTag', tag: ComponentSFCTableVisualCellTag): void
  (event: 'setBinding', payload: { name: string, value: string | null, valueKind: TableCellBindingValueKind }, complete?: (saved: boolean) => void): void
  (event: 'separate'): void
  (event: 'openSource'): void
}>()

const mode = ref<'component' | 'tag' | 'source'>('source')
const drafts = ref<Record<string, string>>({})
const kinds = ref<Record<string, TableCellBindingValueKind>>({})
const errors = ref<Record<string, string>>({})

const componentSelectOptions = computed<SearchableSelectOption[]>(() => (
  props.componentOptions.filter(option => option.editorEligible)
))
const tagSelectOptions = computed<SearchableSelectOption[]>(() => (
  TABLE_CELL_EDITOR_TAGS.map(tag => ({ value: tag, label: tag }))
))
const selectedComponent = computed(() => props.editor?.kind === 'component' ? props.editor.identity : null)
const selectedTag = computed(() => props.editor?.kind === 'tag' ? props.editor.tag : null)
const selectedComponentOption = computed(() => props.componentOptions.find(
  option => option.value === selectedComponent.value,
) ?? null)
const bindings = computed(() => props.editor?.kind === 'component' || props.editor?.kind === 'tag'
  ? props.editor.bindings
  : [])
const fields = computed<BindingField[]>(() => {
  const contract = mode.value === 'component' && props.editor?.kind === 'component'
    ? selectedComponentOption.value?.inputs ?? []
    : mode.value === 'tag' && props.editor?.kind === 'tag'
      ? getComponentSFCTagInputContract(props.editor.tag)
      : []
  const knownNames = new Set(contract.map(input => input.name))
  const sourceOnly = bindings.value
    .filter(binding => !knownNames.has(binding.name))
    .map(binding => ({
      name: binding.name,
      type: 'Source',
      optional: true,
      sourceOnly: true,
    }))
  return [...contract, ...sourceOnly]
})

watch(
  () => props.editor,
  (editor) => {
    mode.value = editor?.kind === 'component'
      ? 'component'
      : editor?.kind === 'tag'
        ? 'tag'
        : props.selecting
          ? 'tag'
          : 'source'
    const nextBindings = editor?.kind === 'component' || editor?.kind === 'tag' ? editor.bindings : []
    drafts.value = Object.fromEntries(nextBindings.map(binding => [binding.name, sourceValue(binding.value)]))
    kinds.value = Object.fromEntries(nextBindings.map(binding => [
      binding.name,
      binding.value.kind === 'expression' ? 'expression' : 'literal',
    ]))
    errors.value = {}
  },
  { immediate: true },
)

function selectMode(nextMode: 'component' | 'tag' | 'source'): void {
  mode.value = nextMode
}

function updateComponent(value: string | string[] | null): void {
  if (!value || Array.isArray(value)) {
    return
  }
  emit('setComponent', value)
}

function updateTag(value: string | string[] | null): void {
  if (!value || Array.isArray(value)) {
    return
  }
  emit('setTag', value as ComponentSFCTableVisualCellTag)
}

function bindingKind(name: string): TableCellBindingValueKind {
  return kinds.value[name]
    ?? (bindings.value.find(binding => binding.name === name)?.value.kind === 'expression' ? 'expression' : 'literal')
}

function setBindingKind(name: string, valueKind: TableCellBindingValueKind): void {
  kinds.value[name] = valueKind
  if (drafts.value[name]?.trim()) {
    commitBinding(name)
  }
}

function resetBinding(name: string): void {
  const binding = bindings.value.find(item => item.name === name)
  drafts.value[name] = binding ? sourceValue(binding.value) : ''
  kinds.value[name] = binding?.value.kind === 'expression' ? 'expression' : 'literal'
  delete errors.value[name]
}

function commitBinding(name: string): boolean {
  if (props.implicit) {
    return true
  }
  const valueKind = bindingKind(name)
  const value = drafts.value[name]?.trim() || null
  if (valueKind === 'expression' && value) {
    const validation = compileComponentSFCExpression(value, {
      sourcePath: `template.Table.Column.Editable.Variant.edit.${name}`,
    })
    const error = validation.diagnostics.find(item => item.severity === 'error')
    if (error) {
      errors.value[name] = error.message
      return false
    }
  }
  delete errors.value[name]
  let saved = true
  emit('setBinding', { name, value, valueKind }, result => saved = result)
  return saved
}

/** Проверяет и публикует все изменённые binding-черновики перед сохранением документа. */
async function flushPendingEdits(): Promise<boolean> {
  for (const field of fields.value) {
    const binding = bindings.value.find(item => item.name === field.name)
    const currentValue = binding ? sourceValue(binding.value) : ''
    const currentKind = binding?.value.kind === 'expression' ? 'expression' : 'literal'
    if ((drafts.value[field.name] ?? '').trim() === currentValue && bindingKind(field.name) === currentKind) {
      continue
    }
    if (!commitBinding(field.name)) {
      return false
    }
    await nextTick()
  }
  return true
}

defineExpose({ flushPendingEdits })

function handleFocusOut(event: FocusEvent, name: string): void {
  const owner = event.currentTarget as HTMLElement | null
  if (owner?.contains(event.relatedTarget as Node | null)) {
    return
  }
  commitBinding(name)
}

function sourceValue(value: { kind: 'boolean', value: boolean } | { kind: 'literal', value: unknown } | { kind: 'expression', source: string }): string {
  return value.kind === 'expression' ? value.source : String(value.value ?? '')
}
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-border/70">
    <div class="flex min-h-12 items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-3 py-2">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium">{{ $t('uiText.editor65d42cf1') }}</span>
          <Badge v-if="implicit" variant="secondary" class="h-5 text-[10px]">
            {{ $t('uiText.builtIneab04386') }}
          </Badge>
          <Badge v-else-if="editor" variant="outline" class="h-5 text-[10px]">
            {{ $t('uiText.variantEditf91c442b') }}
          </Badge>
          <Badge v-else variant="secondary" class="h-5 text-[10px]">
            {{ $t('uiText.notSelected92250813') }}
          </Badge>
        </div>
        <p v-if="implicit" class="mt-0.5 text-[10px] text-muted-foreground">
          {{ $t('uiText.currentlyDisplayAndEditorUseTheSameTag3c2b1d7a') }}
        </p>
        <p v-else-if="selecting" class="mt-0.5 text-[10px] text-muted-foreground">
          {{ $t('uiText.selectionWillCreateAnAppropriateRepresentationInSour18135af4') }}
        </p>
      </div>

      <TooltipProvider :delay-duration="120">
        <div class="editor-control inline-flex items-center rounded-md border border-border/70 p-0.5" role="group" aria-label="Тип редактора">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button type="button" size="icon" variant="ghost" class="size-7" :class="mode === 'component' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'" aria-label="Компонент редактора" @click="selectMode('component')">
                <Blocks class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('uiText.existingComponent00f3092d') }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button type="button" size="icon" variant="ghost" class="size-7" :class="mode === 'tag' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'" aria-label="Tag редактора" @click="selectMode('tag')">
                <Tags class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('uiText.builtInSFCTaga7d43335') }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button type="button" size="icon" variant="ghost" class="size-7" :class="mode === 'source' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'" aria-label="Source редактора" @click="selectMode('source')">
                <FileCode2 class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('uiText.customSourceMarkup2872b476') }}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>

    <div v-if="mode === 'component' || mode === 'tag'" class="grid min-h-40 md:grid-cols-[minmax(210px,0.38fr)_minmax(0,0.62fr)]">
      <div class="editor-control border-b border-border/60 p-3 md:border-b-0 md:border-r">
        <div v-if="mode === 'component'" class="space-y-2">
          <Label>{{ $t('nav.error.component') }}</Label>
          <SearchableSelect :options="componentSelectOptions" :model-value="selectedComponent" placeholder="Найти компонент..." trigger-class="editor-control w-full" @update:model-value="updateComponent" />
          <p class="text-xs text-muted-foreground">
            {{ selectedComponentOption ? `${selectedComponentOption.inputs.length} входных параметров` : $t('uiText.selectComponentdfd14214') }}
          </p>
        </div>
        <div v-else class="space-y-2">
          <Label>{{ $t('uiText.tag982963c1') }}</Label>
          <SearchableSelect :options="tagSelectOptions" :model-value="selectedTag" placeholder="Найти SFC tag..." trigger-class="editor-control w-full font-mono" @update:model-value="updateTag" />
          <p class="text-xs text-muted-foreground">
            {{ $t('uiText.builtInRendererNeutralEditor2b35fd3e') }}
          </p>
        </div>
        <Button v-if="implicit" type="button" variant="outline" size="sm" class="mt-3 w-full" @click="emit('separate')">
          {{ $t('uiText.createASeparateEditordbce7620') }}
        </Button>
      </div>

      <div class="min-w-0 bg-editor-panel">
        <div class="grid grid-cols-[minmax(110px,0.42fr)_minmax(0,0.58fr)] border-b bg-muted/25 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <div>{{ $t('uiText.inputParametera1b0115f') }}</div>
          <div>{{ $t('uiText.value9f0b9909') }}</div>
        </div>
        <div v-if="fields.length" class="divide-y divide-border/60">
          <div v-for="field in fields" :key="field.name" class="grid grid-cols-[minmax(110px,0.42fr)_minmax(0,0.58fr)] items-start gap-3 px-3 py-2.5">
            <div class="min-w-0 pt-1">
              <div class="flex items-center gap-1.5">
                <code class="truncate text-xs font-medium">{{ field.name }}</code>
                <span v-if="!field.optional" class="text-xs text-amber-500">{{ $t('uiText.symboldf58248c') }}</span>
                <Badge v-if="field.sourceOnly" variant="outline" class="h-4 px-1 text-[9px] font-normal">
                  {{ $t('uiText.sourceda13add2') }}
                </Badge>
              </div>
              <div class="mt-0.5 truncate font-mono text-[10px] text-muted-foreground" :title="field.type">
                {{ field.type }}
              </div>
            </div>
            <div class="min-w-0">
              <div class="editor-control flex min-w-0 items-center rounded-md border border-border/70" :class="errors[field.name] ? 'border-destructive/70' : ''" @focusout="handleFocusOut($event, field.name)">
                <Button type="button" variant="ghost" size="sm" class="h-7 min-w-7 rounded-r-none border-r px-1.5 font-mono text-[10px]" :class="bindingKind(field.name) === 'expression' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'" :disabled="implicit" @click="setBindingKind(field.name, 'expression')">
                  {{ $t('uiText.fx06967d8e') }}
                </Button>
                <Button type="button" variant="ghost" size="sm" class="h-7 min-w-7 rounded-none border-r px-1.5 font-mono text-[10px]" :class="bindingKind(field.name) === 'literal' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'" :disabled="implicit" @click="setBindingKind(field.name, 'literal')">
                  {{ $t('uiText.aa2c419ecc') }}
                </Button>
                <Input v-model="drafts[field.name]" class="h-7 min-w-0 flex-1 border-0 bg-transparent px-2 font-mono text-xs shadow-none focus-visible:ring-0" :disabled="implicit" :placeholder="bindingKind(field.name) === 'expression' ? 'row.path.to.value' : 'Значение'" spellcheck="false" @keydown.enter.prevent="commitBinding(field.name)" @keydown.esc.prevent="resetBinding(field.name)" />
              </div>
              <p v-if="errors[field.name]" class="mt-1 text-[10px] leading-tight text-destructive">
                {{ errors[field.name] }}
              </p>
            </div>
          </div>
        </div>
        <div v-else class="flex min-h-24 items-center justify-center px-4 text-center text-xs text-muted-foreground">
          {{ $t('uiText.selectedEditorHasNoInputParameters8afec2f2') }}
        </div>
      </div>
    </div>

    <div v-else class="flex min-h-28 items-center justify-between gap-4 px-4 py-3">
      <div>
        <div class="text-sm font-medium">
          {{ selecting ? $t('uiText.createEditorManuallyaed624eb') : $t('uiText.customEditorccd9fab3') }}
        </div>
        <div class="mt-0.5 text-xs text-muted-foreground">
          {{ selecting
            ? $t('uiText.openSourceAndSetEditableWithOptionsDefaultAndEdit018dc896')
            : $t('uiText.complexVariantEditMarkupCanBeModifiedWithoutConverti679d7a25') }}
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" class="shrink-0 gap-1.5" @click="emit('openSource')">
        {{ $t('uiText.openSource4dda88e1') }}
        <ExternalLink class="size-3.5" />
      </Button>
    </div>
  </div>
</template>
