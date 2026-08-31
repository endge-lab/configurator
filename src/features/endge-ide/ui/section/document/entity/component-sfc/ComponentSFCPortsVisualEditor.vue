<script setup lang="ts">
import type {
  ComponentSFCEventAction,
  ComponentSFCEventInputValue,
  ComponentSFCEventOperationAction,
  ComponentSFCEventPort,
  ComponentSFCPortRole,
  QueryProgramPayload,
} from '@endge/core'
import type { SearchableSelectOption } from '@/components/ui/searchable-select'

import {
  DomainSectionType,
  Endge,
  inspectComponentSFCPortsSource,
  patchComponentSFCPortsSource,
  patchComponentSFCTableSource,
  TABLE_EVENT_DEFINITIONS,
} from '@endge/core'
import { Braces, ChevronDown, Plus, Radio, Trash2, Zap } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Textarea } from '@/components/ui/textarea'
import DomainEntityDropTarget from '@/features/endge-ide/ui/components/DomainEntityDropTarget.vue'

import ComponentSFCReactionEditor from './ComponentSFCReactionEditor.vue'

const props = defineProps<{
  source: string
  mode: 'events' | 'ports'
  tableRef?: string | null
}>()

const emit = defineEmits<{
  (event: 'update:source', source: string): void
  (event: 'openSource', offset: number): void
}>()

const expandedEvents = ref<Set<string>>(new Set())

const projection = computed(() => inspectComponentSFCPortsSource(props.source, {
  resolveComponentPortManifest: (identity: string) => Endge.program.getArtifact<any>('component-sfc', identity)?.payload?.ir?.script.ports ?? null,
}))
const eventPorts = computed(() => projection.value.manifest.emits.events)
const configuredEvents = computed(() => eventPorts.value
  .filter(isExplicitEvent)
  .map((port) => {
    const definition = TABLE_EVENT_DEFINITIONS.find(event => event.name === port.name)
    return {
      name: port.name,
      displayName: definition?.displayName ?? port.displayName ?? port.name,
      payloadType: port.payloadType,
      description: definition?.description ?? describeEvent(port),
      port,
    }
  }))
const availableEvents = computed(() => {
  const catalog = new Map<string, {
    name: string
    displayName: string
    payloadType: string
    description: string
    port: ComponentSFCEventPort | null
  }>()
  for (const definition of TABLE_EVENT_DEFINITIONS) {
    catalog.set(definition.name, {
      ...definition,
      port: eventPorts.value.find(event => event.name === definition.name) ?? null,
    })
  }
  for (const port of eventPorts.value) {
    const definition = TABLE_EVENT_DEFINITIONS.find(event => event.name === port.name)
    catalog.set(port.name, {
      name: port.name,
      displayName: definition?.displayName ?? port.displayName ?? port.name,
      payloadType: port.payloadType,
      description: definition?.description ?? describeEvent(port),
      port,
    })
  }
  const configuredNames = new Set(configuredEvents.value.map(event => event.name))
  return [...catalog.values()].filter(event => !configuredNames.has(event.name))
})
const eventOptions = computed<SearchableSelectOption[]>(() => availableEvents.value.map(event => ({
  value: event.name,
  label: `${event.displayName} · ${event.name}`,
  group: TABLE_EVENT_DEFINITIONS.some(definition => definition.name === event.name)
    ? 'Table events'
    : 'Forwarded events',
  searchText: `${event.payloadType} ${event.description}`,
})))
const requiredPorts = computed(() => [
  ...projection.value.manifest.require.actions,
  ...projection.value.manifest.require.computations,
  ...projection.value.manifest.require.components,
  ...projection.value.manifest.require.queries,
])
const providedPorts = computed(() => projection.value.manifest.provides.actions)

const portRole = ref<ComponentSFCPortRole>('require')
const portKind = ref<'action' | 'computation' | 'component' | 'query'>('action')
const portName = ref('')
const portIdentity = ref('')
const forwardDraft = ref('')
const reactionEditorRefs = ref<Array<{ flushPendingEdits: () => boolean }>>([])
watch(
  () => projection.value.manifest.forward.rules,
  rules => forwardDraft.value = serializeForwardRules(rules),
  { immediate: true, deep: true },
)

function reactionLabel(event: ComponentSFCEventPort): string {
  const reaction = event.action
  if (reaction?.kind === 'typescript') {
    return 'TypeScript sandbox'
  }
  if (reaction?.kind === 'query') {
    return reaction.identity
  }
  if (reaction?.kind !== 'action') {
    return 'Без реакции'
  }
  const action = Endge.actions.listResolved().find(item => item.identity === reaction.identity)
  return action?.displayName || reaction.identity
}

function isExplicitEvent(event: ComponentSFCEventPort): boolean {
  if (!event.sourceRange) {
    return false
  }
  return !projection.value.manifest.forward.rules.some(rule => (
    rule.sourceRange?.start === event.sourceRange?.start
    && rule.sourceRange?.end === event.sourceRange?.end
  ))
}

function describeEvent(event: ComponentSFCEventPort): string {
  if (event.forwardedFrom) {
    return `Событие ${event.forwardedFrom.ref ?? event.forwardedFrom.componentTag}.`
  }
  if (event.from) {
    return `Событие ${event.from.ref}.`
  }
  return 'Событие компонента.'
}

function saveReaction(
  name: string,
  payloadType: string,
  port: ComponentSFCEventPort | null,
  value: string | null,
  complete?: (saved: boolean) => void,
): void {
  const saved = applyEvent(name, payloadType, port, value)
  complete?.(saved)
}

function applyEvent(name: string, payloadType: string, port: ComponentSFCEventPort | null, actionSource: string | null): boolean {
  let source = props.source
  let refName = port?.from?.ref ?? port?.forwardedFrom?.ref ?? props.tableRef?.trim() ?? ''
  const isIntrinsic = TABLE_EVENT_DEFINITIONS.some(definition => definition.name === name)
  const isTableOrigin = port?.forwardedFrom?.componentTag.toLowerCase() === 'table'
  if ((isIntrinsic || isTableOrigin) && !refName) {
    refName = 'table'
    const tablePatch = patchComponentSFCTableSource(source, { type: 'set-table-attribute', name: 'ref', value: refName })
    if (!tablePatch.ok) {
      return fail(tablePatch.message)
    }
    source = tablePatch.source
  }
  const result = patchComponentSFCPortsSource(source, {
    type: 'set-event',
    name,
    payloadType,
    from: port?.from
      ?? (port?.forwardedFrom && refName ? { ref: refName, event: port.forwardedFrom.portName } : null)
      ?? (isIntrinsic ? { ref: refName, event: name } : null),
    actionSource,
  })
  return commit(result)
}

function addEvent(name: string): void {
  const event = availableEvents.value.find(item => item.name === name)
  if (!event || !applyEvent(event.name, event.payloadType, event.port, null)) {
    return
  }
  expandedEvents.value = new Set([...expandedEvents.value, name])
}

function selectEvent(value: string | string[] | null): void {
  if (typeof value === 'string') {
    addEvent(value)
  }
}

function setEventExpanded(name: string, expanded: boolean): void {
  const next = new Set(expandedEvents.value)
  if (expanded) {
    next.add(name)
  }
  else {
    next.delete(name)
  }
  expandedEvents.value = next
}

function removeEvent(name: string): void {
  if (!commit(patchComponentSFCPortsSource(props.source, { type: 'remove-port', role: 'emits', name }))) {
    return
  }
  const next = new Set(expandedEvents.value)
  next.delete(name)
  expandedEvents.value = next
}

function addPort(): void {
  const name = portName.value.trim()
  const identity = portIdentity.value.trim()
  if (!name) {
    return
  }
  const role = portRole.value
  const kind = role === 'provides' ? 'action' : portKind.value
  const queryDeclaration = kind === 'query' ? createQueryPortDeclaration(identity) : null
  if (kind === 'query' && !queryDeclaration) {
    fail('Query должна существовать и компилироваться, чтобы получить её input contract.')
    return
  }
  const declaration = kind === 'component'
    ? `component<Record<string, unknown>>({ default: ${JSON.stringify(identity)}, tag: ${JSON.stringify(name)} })`
    : kind === 'computation'
      ? `computation<unknown, unknown>({ default: ${JSON.stringify(identity)} })`
      : kind === 'query'
        ? queryDeclaration!
        : role === 'require'
          ? `action<unknown, unknown>({ default: ${JSON.stringify(identity)} })`
          : `action<unknown, unknown>()`
  const result = patchComponentSFCPortsSource(props.source, { type: 'upsert-port', role, name, declaration })
  if (commit(result)) {
    portName.value = ''
    portIdentity.value = ''
  }
}

function createQueryPortDeclaration(identity: string): string | null {
  const query = Endge.domain.getQuery(identity)
  if (!query) {
    return null
  }
  const payload = Endge.source.compile('query', query.source).artifact as QueryProgramPayload | undefined
  if (!payload) {
    return null
  }
  const fields = payload.props.map((field) => {
    const type = field.array ? `Array<${field.type}>` : field.type
    return `${field.key}${field.optional ? '?' : ''}: ${type}`
  })
  const inputType = fields.length ? `{ ${fields.join('; ')} }` : 'Record<string, never>'
  return `query<${inputType}, void>({ default: ${JSON.stringify(identity)} })`
}

function removePort(role: ComponentSFCPortRole, name: string): void {
  commit(patchComponentSFCPortsSource(props.source, { type: 'remove-port', role, name }))
}

function saveForward(): boolean {
  const declaration = forwardDraft.value.trim() || null
  return commit(patchComponentSFCPortsSource(props.source, { type: 'set-forward', declaration }))
}

/** Применяет reaction и forwarding существующих ports перед сохранением документа. */
async function flushPendingEdits(): Promise<boolean> {
  for (const editor of [...reactionEditorRefs.value]) {
    if (!editor.flushPendingEdits()) {
      return false
    }
    await nextTick()
  }

  const persistedForward = serializeForwardRules(projection.value.manifest.forward.rules).trim()
  if (forwardDraft.value.trim() !== persistedForward) {
    if (!saveForward()) {
      return false
    }
    await nextTick()
  }
  return true
}

defineExpose({ flushPendingEdits })

function onEntityDrop(payload: { id: string | number, sectionType: DomainSectionType }): void {
  const entity = payload.sectionType === DomainSectionType.Action
    ? Endge.domain.getActions().find(item => String(item.id) === String(payload.id))
    : payload.sectionType === DomainSectionType.Computation
      ? Endge.domain.getComputations().find(item => String(item.id) === String(payload.id))
      : payload.sectionType === DomainSectionType.Query
        ? Endge.domain.getQueries().find(item => String(item.id) === String(payload.id))
        : Endge.domain.getComponentSFCs().find(item => String(item.id) === String(payload.id))
  if (!entity) {
    return
  }
  portIdentity.value = entity.identity
  portName.value = toPortName(entity.identity)
  portRole.value = 'require'
  portKind.value = payload.sectionType === DomainSectionType.Action
    ? 'action'
    : payload.sectionType === DomainSectionType.Computation
      ? 'computation'
      : payload.sectionType === DomainSectionType.Query ? 'query' : 'component'
}

function reactionSource(event: ComponentSFCEventPort): string | null {
  return event.action ? serializeReaction(event.action) : null
}

function serializeReaction(reaction: ComponentSFCEventAction): string {
  if (reaction.kind === 'typescript') {
    return reaction.definitionSource ?? reaction.source
  }
  if (reaction.kind === 'action') {
    return `{ identity: ${JSON.stringify(reaction.identity)}${reaction.input ? `, input: ${serializeEventInput(reaction.input)}` : ''} }`
  }
  if (reaction.kind === 'query') {
    return `query({ identity: ${JSON.stringify(reaction.identity)}${reaction.input ? `, input: ${serializeEventInput(reaction.input)}` : ''} })`
  }
  if (reaction.kind === 'emit') {
    return `emit(${JSON.stringify(reaction.event)}${reaction.payload ? `, ${serializeEventInput(reaction.payload)}` : ''})`
  }
  if (reaction.kind === 'operation') {
    const input = reaction.input ? `input: ${serializeEventInput(reaction.input)}, ` : ''
    const redo = reaction.redo ? `, redo: ${serializeOperationBlock(reaction.redo)}` : ''
    return `operation({ ${input}run: ${serializeOperationBlock(reaction.run)}, undo: ${serializeOperationBlock(reaction.undo)}${redo} })`
  }
  return `ports.require.${reaction.port}(${reaction.input ? serializeEventInput(reaction.input) : '{}'})`
}

function serializeOperationBlock(block: ComponentSFCEventOperationAction['run']): string {
  const steps = block.steps
    .map(step => `${JSON.stringify(step.name)}: ${serializeReaction(step.action)}`)
    .join(', ')
  const output = block.output ? `, output: output(${JSON.stringify(block.output)})` : ''
  return `{ steps: { ${steps} }${output} }`
}

function serializeEventInput(input: ComponentSFCEventInputValue): string {
  if (input.kind === 'event') {
    return input.path == null ? 'event()' : `event(${JSON.stringify(input.path)})`
  }
  if (input.kind === 'operation-input') {
    return input.path == null ? 'input()' : `input(${JSON.stringify(input.path)})`
  }
  if (input.kind === 'now') {
    return 'now()'
  }
  if (input.kind === 'scope') {
    return input.path
  }
  if (input.kind === 'literal') {
    return JSON.stringify(input.value) ?? 'null'
  }
  if (input.kind === 'coalesce') {
    return `${serializeEventInput(input.left)} ?? ${serializeEventInput(input.right)}`
  }
  if (input.kind === 'array') {
    return `[${input.items.map(serializeEventInput).join(', ')}]`
  }
  return `{ ${input.entries.map(entry => `${typeof entry.key === 'string' ? JSON.stringify(entry.key) : `[${serializeEventInput(entry.key)}]`}: ${serializeEventInput(entry.value)}`).join(', ')} }`
}

function serializeForwardRules(rules: any[]): string {
  if (!rules.length) {
    return ''
  }
  return rules.length === 1 ? serializeForwardRule(rules[0]) : `[${rules.map(serializeForwardRule).join(', ')}]`
}

function serializeForwardRule(rule: any): string {
  const from = rule.from === '*' ? `'*'` : JSON.stringify(rule.from.length === 1 ? rule.from[0] : rule.from)
  const ports = Object.entries(rule.ports)
    .map(([role, selector]: [string, any]) => `${role}: ${serializeForwardSelector(selector)}`)
    .join(', ')
  const namespace = rule.namespace && rule.namespace !== 'none'
    ? `, namespace: ${JSON.stringify(rule.namespace)}`
    : ''
  return `{ from: ${from}, ports: { ${ports} }${namespace} }`
}

function serializeForwardSelector(selector: any): string {
  const simple = (selector.exclude?.length ?? 0) === 0
    && Object.keys(selector.rename ?? {}).length === 0
    && (!selector.namespace || selector.namespace === 'none')
  if (simple) {
    return selector.include === '*' ? `'*'` : JSON.stringify(selector.include)
  }
  return `{ include: ${selector.include === '*' ? `'*'` : JSON.stringify(selector.include)}, exclude: ${JSON.stringify(selector.exclude ?? [])}, rename: ${JSON.stringify(selector.rename ?? {})}${selector.namespace && selector.namespace !== 'none' ? `, namespace: ${JSON.stringify(selector.namespace)}` : ''} }`
}

function commit(result: { ok: boolean, source: string, message?: string }): boolean {
  if (!result.ok) {
    return fail(result.message)
  }
  emit('update:source', result.source)
  return true
}

function fail(message?: string): false {
  toast.error('Source не изменён', { description: message || 'Конструкция доступна только в Source-режиме.' })
  return false
}

function toPortName(identity: string): string {
  const tail = identity.split(/[./:-]/).filter(Boolean).at(-1) ?? 'port'
  return tail.replace(/[^\w$]/g, '_').replace(/^\d/, '_$&')
}
</script>

<template>
  <div class="space-y-4 p-5">
    <div v-if="!projection.editable" class="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
      {{ projection.message }} {{ $t('uiText.theEditorWillNotOverwriteThisBlock1aa1ac50') }}
    </div>

    <template v-if="mode === 'events'">
      <div class="ml-auto max-w-md">
        <SearchableSelect
          :model-value="null"
          :options="eventOptions"
          :disabled="!projection.editable || !availableEvents.length"
          :placeholder="availableEvents.length ? 'Добавить событие...' : 'Все события добавлены'"
          trigger-class="editor-control w-full"
          size="compact"
          @update:model-value="selectEvent"
        />
      </div>

      <Collapsible
        v-for="item in configuredEvents"
        :key="item.name"
        :open="expandedEvents.has(item.name)"
        class="editor-panel rounded-lg border"
        @update:open="setEventExpanded(item.name, $event)"
      >
        <div class="flex min-h-16 items-center gap-2 p-3">
          <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" @click="setEventExpanded(item.name, !expandedEvents.has(item.name))">
            <ChevronDown class="size-4 shrink-0 text-muted-foreground transition-transform" :class="{ '-rotate-90': !expandedEvents.has(item.name) }" />
            <span class="min-w-0 flex-1">
              <span class="block font-mono text-sm">{{ item.name }}</span>
              <span class="mt-0.5 block truncate text-xs text-muted-foreground">{{ item.displayName }} {{ $t('uiText.symbol1fdf0d90') }} {{ item.payloadType }}</span>
            </span>
            <span class="hidden max-w-[20rem] truncate text-xs text-muted-foreground sm:block">{{ reactionLabel(item.port) }}</span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            class="size-8 shrink-0"
            title="Убрать из настройки"
            :disabled="!projection.editable"
            @click="removeEvent(item.name)"
          >
            <Trash2 class="size-3.5" />
          </Button>
        </div>
        <CollapsibleContent>
          <div class="border-t p-3">
            <ComponentSFCReactionEditor
              ref="reactionEditorRefs"
              :model-value="reactionSource(item.port)"
              :event-name="item.name"
              action-format="object"
              allow-remove
              @save="(value, complete) => saveReaction(item.name, item.payloadType, item.port, value, complete)"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </template>

    <template v-else>
      <div class="grid gap-3 xl:grid-cols-2">
        <section class="rounded-lg border p-3">
          <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {{ $t('uiText.requiredeed6bfb4') }}
          </h4>
          <div v-for="port in requiredPorts" :key="`${port.kind}:${port.name}`" class="flex items-center gap-2 border-t py-2 first:border-0">
            <Badge variant="outline">
              {{ port.kind }}
            </Badge><span class="font-mono text-xs">{{ port.name }}</span>
            <span class="truncate text-xs text-muted-foreground">{{ 'defaultIdentity' in port ? port.defaultIdentity : undefined }}</span>
            <Button class="ml-auto" variant="ghost" size="icon" @click="removePort('require', port.name)">
              <Trash2 class="size-3.5" />
            </Button>
          </div>
        </section>
        <section class="rounded-lg border p-3">
          <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {{ $t('uiText.providede93470b0') }}
          </h4>
          <div v-for="port in providedPorts" :key="port.name" class="flex items-center gap-2 border-t py-2 first:border-0">
            <Badge variant="outline">
              {{ $t('uiText.action34eb4c4e') }}
            </Badge><span class="font-mono text-xs">{{ port.name }}</span>
            <Button class="ml-auto" variant="ghost" size="icon" @click="removePort('provides', port.name)">
              <Trash2 class="size-3.5" />
            </Button>
          </div>
        </section>
      </div>

      <DomainEntityDropTarget :accept-section-types="[DomainSectionType.Component, DomainSectionType.Action, DomainSectionType.Computation, DomainSectionType.Query]" hint-text="Перетащите Component, Action, Computation или Query из домена" @entity-drop="onEntityDrop">
        <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <select v-model="portRole" class="editor-control h-9 rounded-md border bg-background px-2 text-sm">
            <option value="require">
              {{ $t('uiText.requiredeed6bfb4') }}
            </option><option value="provides">
              {{ $t('uiText.providede93470b0') }}
            </option>
          </select>
          <select v-model="portKind" class="editor-control h-9 rounded-md border bg-background px-2 text-sm" :disabled="portRole === 'provides'">
            <option value="action">
              {{ $t('uiText.action97c89a4d') }}
            </option><option value="query">
              {{ $t('uiText.querya618b4be') }}
            </option><option value="computation">
              {{ $t('uiText.computationcd260770') }}
            </option><option value="component">
              {{ $t('uiText.componentc92c529e') }}
            </option>
          </select>
          <Input v-model="portName" placeholder="portName" />
          <Input v-model="portIdentity" placeholder="domain.identity" :disabled="portRole === 'provides'" />
          <Button :disabled="!projection.editable" @click="addPort">
            <Plus class="mr-1 size-4" />{{ $t('uiText.add559a87f7') }}
          </Button>
        </div>
      </DomainEntityDropTarget>

      <section class="rounded-lg border p-3">
        <h4 class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Radio class="size-3.5" /> {{ $t('uiText.eventsc5497bca') }}
        </h4>
        <div class="mt-2 flex flex-wrap gap-2">
          <Badge v-for="event in eventPorts" :key="event.name" variant="secondary">
            {{ event.name }}: {{ event.payloadType }}
          </Badge>
        </div>
      </section>

      <section class="space-y-2 rounded-lg border p-3">
        <h4 class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Braces class="size-3.5" /> {{ $t('uiText.forwardingd735aafe') }}
        </h4>
        <Textarea v-model="forwardDraft" class="min-h-28 font-mono text-xs" placeholder="{ from: 'table', ports: { emits: '*' } }" />
        <Button size="sm" :disabled="!projection.editable" @click="saveForward">
          <Zap class="mr-1 size-4" />{{ $t('uiText.saveForwarda8daa4f8') }}
        </Button>
      </section>
    </template>
  </div>
</template>
