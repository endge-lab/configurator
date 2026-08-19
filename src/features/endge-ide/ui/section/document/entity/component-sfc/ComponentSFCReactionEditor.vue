<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { SearchableSelectOption } from '@/components/ui/searchable-select'

import { compileComponentSFCExpression, Endge } from '@endge/core'
import { useDomainStore } from '@endge/ui-vue'
import { ChevronDown, Plus, Save, Trash2, X } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Textarea } from '@/components/ui/textarea'

const props = withDefaults(defineProps<{
  modelValue: string | null
  eventName?: string
  variant?: 'field' | 'section'
}>(), {
  eventName: 'edited',
  variant: 'field',
})

const emit = defineEmits<{
  (event: 'save', value: string | null): void
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
    label: actionTitle(action),
    group: 'Actions',
  })),
  ...queries.value.map(query => ({
    value: `query:${query.identity}`,
    label: entityTitle(query),
    group: 'Queries',
  })),
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

function removeReaction(): void {
  draft.value = ''
  error.value = null
  expanded.value = false
  emit('save', null)
}

function saveReaction(): void {
  const source = draft.value.trim()
  if (!source) {
    removeReaction()
    return
  }
  const validation = compileComponentSFCExpression(source, {
    sourcePath: `template.on.${props.eventName}`,
  })
  const firstError = validation.diagnostics.find(diagnostic => diagnostic.severity === 'error')
  if (firstError) {
    error.value = firstError.message
    return
  }
  error.value = null
  emit('save', source)
}

function handleReactionKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) {
    return
  }
  event.preventDefault()
  saveReaction()
}

function insertTemplate(value: string | string[] | null): void {
  if (!value || Array.isArray(value)) {
    return
  }
  const separator = value.indexOf(':')
  const kind = separator > 0 ? value.slice(0, separator) : ''
  const identity = separator > 0 ? value.slice(separator + 1) : ''
  if (!identity) {
    return
  }
  draft.value = kind === 'action'
    ? serializeAction(identity)
    : serializeQuery(identity)
  error.value = null
  expanded.value = true
}

function serializeAction(identity: string): string {
  const definition = Endge.actions.getDefinition(identity)
  const params = [...(definition?.input?.params?.values() ?? [])]
  const input = params.length
    ? `{ ${params.map(param => `${param.name}: ${eventInputSource(param.name)}`).join(', ')} }`
    : props.eventName === 'edited'
      ? `{ value: event('value'), previousValue: event('previousValue') }`
      : 'event()'
  return `action({ identity: ${quote(identity)}, input: ${input} })`
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

function eventInputSource(name: string): string {
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

function summarizeReaction(source: string | null): { kind: 'action' | 'query' | 'custom' | 'none', label: string } {
  const value = source?.trim() ?? ''
  if (!value) {
    return { kind: 'none', label: 'Не настроено' }
  }
  const match = value.match(/^\s*(action|query)\s*\(\s*\{[\s\S]*?\bidentity\s*:\s*(['"])(.*?)\2/)
  if (!match) {
    return { kind: 'custom', label: 'Произвольный код' }
  }
  const kind = match[1] === 'query' ? 'query' : 'action'
  return { kind, label: match[3] || (kind === 'query' ? 'Query' : 'Action') }
}

function reactionKindLabel(kind: 'action' | 'query' | 'custom' | 'none'): string {
  if (kind === 'action') {
    return 'Action'
  }
  if (kind === 'query') {
    return 'Query'
  }
  return 'Code'
}

function actionTitle(action: { displayName?: string, identity: string }): string {
  return String(action.displayName ?? '').trim() || action.identity
}

function entityTitle(entity: { name?: unknown, identity?: unknown, id?: unknown }): string {
  return String(entity.name ?? '').trim()
    || String(entity.identity ?? '').trim()
    || String(entity.id ?? '').trim()
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
          <span class="block text-sm font-medium">После редактирования</span>
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
        Добавить реакцию
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
          <div class="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div class="space-y-1.5">
              <Label class="text-xs">Шаблон</Label>
              <SearchableSelect
                :options="templateOptions"
                :model-value="null"
                placeholder="Вставить Action или Query..."
                trigger-class="editor-control w-full"
                size="compact"
                @update:model-value="insertTemplate"
              />
            </div>
            <div class="flex justify-end gap-1.5">
              <Button type="button" variant="ghost" size="sm" class="h-8 gap-1.5" @click="cancelEditing">
                <X class="size-3.5" />
                Отменить
              </Button>
              <Button type="button" size="sm" class="h-8 gap-1.5" @click="saveReaction">
                <Save class="size-3.5" />
                Сохранить
              </Button>
            </div>
          </div>

          <div class="space-y-1.5">
            <Label class="text-xs">Reaction</Label>
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
              <span class="shrink-0 text-muted-foreground">event('value') · event('previousValue')</span>
            </div>
          </div>
        </div>
      </div>
    </component>
  </component>
</template>
