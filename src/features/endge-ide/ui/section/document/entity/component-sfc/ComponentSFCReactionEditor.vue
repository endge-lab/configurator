<script setup lang="ts">
import type { RComponentDiagnostic } from '@endge/core'
import type { SearchableSelectOption } from '@/features/endge-ide/ui/components/searchable-select'

import {
  compileComponentSFCLocalEventAction,
  createEmptyComponentDependencies,
  DomainSectionType,
  Endge,
} from '@endge/core'
import { useDomainStore } from '@endge/ui-vue'
import { ChevronDown, Plus, Save, Trash2, X } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import DomainEntityDropTarget from '@/features/endge-ide/ui/components/DomainEntityDropTarget.vue'
import { SearchableSelect } from '@/features/endge-ide/ui/components/searchable-select'

const props = withDefaults(defineProps<{
  modelValue: string | null
  eventName?: string
  variant?: 'field' | 'section'
  actionFormat?: 'call' | 'object'
  allowRemove?: boolean
}>(), {
  eventName: 'edited',
  variant: 'field',
  actionFormat: 'call',
  allowRemove: false,
})

const emit = defineEmits<{
  (event: 'save', value: string | null, complete?: (saved: boolean) => void): void
}>()

const domainStore = useDomainStore()
const actionsRevision = ref(0)
const unsubscribeActions = Endge.actions.subscribe(() => actionsRevision.value += 1)
const draft = ref(props.modelValue ?? '')
const expanded = ref(false)
const error = ref<string | null>(null)

const actions = computed(() => (void actionsRevision.value, Endge.actions.listResolved())
  .filter(action => action.active && Boolean(action.identity.trim()))
  .sort((left, right) => actionTitle(left).localeCompare(actionTitle(right))))
const queries = computed(() => (domainStore.queries ?? [])
  .filter(query => Boolean(String(query.identity ?? '').trim()))
  .sort((left, right) => entityTitle(left).localeCompare(entityTitle(right))))
const templateOptions = computed<SearchableSelectOption[]>(() => [
  ...actions.value.map(action => ({
    value: `action:${action.identity}`,
    label: actionOptionLabel(action),
    group: actionGroup(action),
    searchText: `${action.identity} ${action.description ?? ''}`,
  })),
  ...queries.value.map(query => ({
    value: `query:${query.identity}`,
    label: entityOptionLabel(query),
    group: 'Queries',
  })),
  {
    value: 'typescript:__sandbox__',
    label: 'TypeScript sandbox',
    group: 'Code',
    searchText: 'typescript code sandbox код',
  },
])
const hasReaction = computed(() => Boolean(props.modelValue?.trim()))
const reactionSummary = computed(() => summarizeReaction(props.modelValue))

watch(
  () => props.modelValue,
  (value) => {
    draft.value = value ?? ''
    error.value = null
  },
)

onBeforeUnmount(unsubscribeActions)

function startEditing(): void {
  expanded.value = true
  error.value = null
}

function cancelEditing(): void {
  draft.value = props.modelValue ?? ''
  error.value = null
  if (props.variant === 'section' || !hasReaction.value) {
    expanded.value = false
  }
}

function removeReaction(): boolean {
  draft.value = ''
  error.value = null
  let saved = true
  emit('save', null, result => saved = result)
  if (saved) {
    expanded.value = false
  }
  return saved
}

function saveReaction(): boolean {
  const source = draft.value.trim()
  if (!source) {
    if (props.variant === 'field' && !props.allowRemove) {
      error.value = 'Выберите Action, Query или TypeScript reaction.'
      return false
    }
    return removeReaction()
  }
  const diagnostics: RComponentDiagnostic[] = []
  const validationSource = props.actionFormat === 'object' && source.startsWith('{')
    ? `(${source})`
    : source
  compileComponentSFCLocalEventAction(
    props.eventName,
    validationSource,
    0,
    createEmptyComponentDependencies(),
    diagnostics,
  )
  const firstError = diagnostics.find(diagnostic => diagnostic.severity === 'error')
  if (firstError) {
    error.value = firstError.message
    return false
  }
  error.value = null
  let saved = true
  emit('save', source, result => saved = result)
  return saved
}

/** Применяет изменённую существующую reaction перед сохранением документа. */
function flushPendingEdits(): boolean {
  if (draft.value.trim() === (props.modelValue ?? '').trim()) {
    return true
  }
  return saveReaction()
}

defineExpose({ flushPendingEdits })

function handleReactionKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) {
    return
  }
  event.preventDefault()
  saveReaction()
}

function applyTemplate(value: string | string[] | null): void {
  const kind = insertTemplate(value)
  if (kind === 'action' || kind === 'query') {
    saveReaction()
  }
}

function insertTemplate(value: string | string[] | null): 'action' | 'query' | 'typescript' | null {
  if (!value || Array.isArray(value)) {
    return null
  }
  const separator = value.indexOf(':')
  const kind = separator > 0 ? value.slice(0, separator) : ''
  const identity = separator > 0 ? value.slice(separator + 1) : ''
  if (!identity) {
    return null
  }
  draft.value = kind === 'action'
    ? serializeAction(identity)
    : kind === 'query'
      ? serializeQuery(identity)
      : serializeTypescript()
  error.value = null
  expanded.value = true
  return kind === 'action' || kind === 'query' ? kind : 'typescript'
}

function serializeAction(identity: string): string {
  const definition = Endge.actions.getDefinition(identity)
  const inputContract = definition?.contract.input
  const params = inputContract
    && typeof inputContract === 'object'
    && 'params' in inputContract
    && inputContract.params instanceof Map
    ? [...inputContract.params.values()] as Array<{ name: string }>
    : []
  const input = params.length
    ? `{ ${params.map(param => `${param.name}: ${eventInputSource(param.name)}`).join(', ')} }`
    : inputContract
      ? props.eventName === 'edited'
        ? `{ value: event('value'), previousValue: event('previousValue') }`
        : 'event()'
      : null
  const binding = `{ identity: ${quote(identity)}${input ? `, input: ${input}` : ''} }`
  return props.actionFormat === 'object' ? binding : `action(${binding})`
}

function serializeQuery(identity: string): string {
  const input = props.eventName === 'edited'
    ? `{
    value: event('value'),
    previousValue: event('previousValue'),
  }`
    : 'event()'
  return `query({
  identity: ${quote(identity)},
  input: ${input},
})`
}

function serializeTypescript(): string {
  return `typescript({
  inputs: { event: event() },
  compute({ event }, api) {
    return api.action('built-in-console-log', event)
  },
})`
}

function onEntityDrop(payload: {
  id: string | number
  identity?: string
  sectionType: DomainSectionType
}): void {
  const identity = String(payload.identity ?? resolveDroppedIdentity(payload) ?? '').trim()
  if (!identity) {
    return
  }
  applyTemplate(`${payload.sectionType === DomainSectionType.Query ? 'query' : 'action'}:${identity}`)
}

function resolveDroppedIdentity(payload: { id: string | number, sectionType: DomainSectionType }): string | null {
  if (payload.sectionType === DomainSectionType.Action) {
    return Endge.domain.getActions().find(action => String(action.id) === String(payload.id))?.identity ?? null
  }
  if (payload.sectionType === DomainSectionType.Query) {
    return (domainStore.queries ?? []).find(query => String(query.id) === String(payload.id))?.identity ?? null
  }
  return null
}

function eventInputSource(name: string): string {
  if (props.actionFormat === 'object') {
    return name === 'event' ? 'event()' : `event(${quote(name)})`
  }
  if (name === 'rowId' || name === 'rowKey') {
    return 'rowKey'
  }
  if (name === 'row' || name === 'rowIndex' || name === 'columnKey') {
    return name
  }
  if (name === 'value' && props.eventName !== 'edited') {
    return 'value'
  }
  if (name === 'event') {
    return 'event()'
  }
  return `event(${quote(name)})`
}

function summarizeReaction(source: string | null): { kind: 'action' | 'query' | 'typescript' | 'custom' | 'none', label: string } {
  const value = source?.trim() ?? ''
  if (!value) {
    return { kind: 'none', label: 'Не настроено' }
  }
  if (/^\s*typescript\s*\(/.test(value)) {
    return { kind: 'typescript', label: 'TypeScript sandbox' }
  }
  const match = value.match(/^\s*(action|query)\s*\(\s*\{[\s\S]*?\bidentity\s*:\s*(['"])(.*?)\2/)
    ?? value.match(/^\s*\{[\s\S]*?\bidentity\s*:\s*(['"])(.*?)\1/)
  if (!match) {
    return { kind: 'custom', label: 'Произвольный код' }
  }
  const kind = match[1] === 'query' ? 'query' : 'action'
  const label = match[3] ?? match[2]
  return { kind, label: label || (kind === 'query' ? 'Query' : 'Action') }
}

function reactionKindLabel(kind: 'action' | 'query' | 'typescript' | 'custom' | 'none'): string {
  if (kind === 'action') {
    return 'Action'
  }
  if (kind === 'query') {
    return 'Query'
  }
  if (kind === 'typescript') {
    return 'TS'
  }
  return 'Code'
}

function actionTitle(action: { displayName?: string, identity: string }): string {
  return String(action.displayName ?? '').trim() || action.identity
}

function actionOptionLabel(action: { displayName?: string, identity: string }): string {
  const title = actionTitle(action)
  return title === action.identity ? title : `${title} · ${action.identity}`
}

function actionGroup(action: { origin: { kind: string }, catalogPath?: string[] }): string {
  const origin = action.origin.kind === 'builtin'
    ? 'Built-in'
    : action.origin.kind === 'local'
      ? 'Local'
      : action.origin.kind === 'derived'
        ? 'Provided'
        : 'Project'
  return ['Actions', origin, ...(action.catalogPath ?? [])].join(' / ')
}

function entityTitle(entity: { name?: unknown, identity?: unknown, id?: unknown }): string {
  return String(entity.name ?? '').trim()
    || String(entity.identity ?? '').trim()
    || String(entity.id ?? '').trim()
}

function entityOptionLabel(entity: { name?: unknown, identity?: unknown, id?: unknown }): string {
  const title = entityTitle(entity)
  const identity = String(entity.identity ?? '').trim()
  return identity && title !== identity ? `${title} · ${identity}` : title
}

function quote(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, String.raw`\'`)
  return `'${escaped}'`
}
</script>

<template>
  <component
    :is="variant === 'section' ? Collapsible : 'div'"
    :open="variant === 'section' ? expanded : undefined"
    :class="variant === 'section' ? 'editor-panel overflow-hidden rounded-lg border border-border/70' : ''"
    @update:open="expanded = $event"
  >
    <div v-if="variant === 'section'" class="flex min-h-12 items-center gap-2 px-3 py-2">
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-2 text-left"
        @click="expanded = !expanded"
      >
        <ChevronDown
          class="size-4 shrink-0 text-muted-foreground transition-transform"
          :class="{ '-rotate-90': !expanded }"
        />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium">{{ $t('uiText.afterEditingccdb7a1c') }}</span>
          <span v-if="hasReaction" class="mt-0.5 flex min-w-0 items-center gap-1.5">
            <Badge variant="secondary" class="h-4 px-1.5 text-[9px] uppercase">
              {{ reactionKindLabel(reactionSummary.kind) }}
            </Badge>
            <code class="truncate text-[10px] text-muted-foreground">{{ reactionSummary.label }}</code>
          </span>
        </span>
      </button>

      <Button
        v-if="!hasReaction && !expanded"
        type="button"
        variant="ghost"
        size="sm"
        class="h-7 gap-1.5 text-xs"
        @click="startEditing"
      >
        <Plus class="size-3.5" />
        {{ $t('uiText.addReactiond7261f38') }}
      </Button>
      <Button
        v-else-if="hasReaction"
        type="button"
        variant="ghost"
        size="icon"
        class="size-7 text-muted-foreground hover:text-destructive"
        aria-label="Удалить реакцию edited"
        @click="removeReaction"
      >
        <Trash2 class="size-3.5" />
      </Button>
    </div>

    <component :is="variant === 'section' ? CollapsibleContent : 'div'">
      <div :class="variant === 'section' ? 'border-t border-border/60 p-3' : ''">
        <div class="space-y-3">
          <DomainEntityDropTarget
            :accept-section-types="[DomainSectionType.Action, DomainSectionType.Query]"
            hint-text="Перетащите Action или Query из виджета Домен"
            @entity-drop="onEntityDrop"
          >
            <div class="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div class="space-y-1.5">
                <Label class="text-xs">{{ $t('uiText.template7bd54e89') }}</Label>
                <SearchableSelect
                  :options="templateOptions"
                  :model-value="null"
                  placeholder="Вставить Action, Query или TypeScript..."
                  trigger-class="editor-control w-full"
                  size="compact"
                  @update:model-value="applyTemplate"
                />
              </div>
              <div class="flex justify-end gap-1.5">
                <Button v-if="allowRemove && hasReaction" type="button" variant="ghost" size="sm" class="h-8 gap-1.5 text-muted-foreground hover:text-destructive" @click="removeReaction">
                  <Trash2 class="size-3.5" />
                  {{ $t('uiText.delete86ea33ae') }}
                </Button>
                <Button type="button" variant="ghost" size="sm" class="h-8 gap-1.5" @click="cancelEditing">
                  <X class="size-3.5" />
                  {{ $t('uiText.cancel555ad1c0') }}
                </Button>
                <Button type="button" size="sm" class="h-8 gap-1.5" @click="saveReaction">
                  <Save class="size-3.5" />
                  {{ $t('uiText.save4864057d') }}
                </Button>
              </div>
            </div>
          </DomainEntityDropTarget>

          <div class="space-y-1.5">
            <Label class="text-xs">{{ $t('uiText.reactionf996ddc3') }}</Label>
            <Textarea
              v-model="draft"
              class="editor-control min-h-32 resize-y font-mono text-xs leading-relaxed"
              placeholder="query({ identity: '...', input: {} })"
              spellcheck="false"
              @keydown="handleReactionKeydown"
            />
            <div class="flex items-start justify-between gap-3 text-[10px]">
              <span :class="error ? 'text-destructive' : 'text-muted-foreground'">
                {{ error || 'Сохранить: Ctrl/Cmd + Enter' }}
              </span>
              <span class="shrink-0 text-muted-foreground">{{ $t('uiText.eventValueEventPreviousValue7d58f120') }}</span>
            </div>
          </div>
        </div>
      </div>
    </component>
  </component>
</template>
