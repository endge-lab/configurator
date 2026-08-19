<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { ComponentSFCEventPort, ComponentSFCPortRole, RAction } from '@endge/core'
import {
  DomainSectionType,
  Endge,
  inspectComponentSFCPortsSource,
  patchComponentSFCPortsSource,
  patchComponentSFCTableSource,
  TABLE_EVENT_DEFINITIONS,
} from '@endge/core'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Braces, ChevronDown, Plus, Radio, Trash2, Zap } from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import DomainEntityDropTarget from '@/features/endge-ide/ui/components/DomainEntityDropTarget.vue'

const props = defineProps<{
  source: string
  mode: 'events' | 'ports'
  tableRef?: string | null
}>()

const emit = defineEmits<{
  (event: 'update:source', source: string): void
  (event: 'openSource', offset: number): void
}>()

const eventPickerOpen = ref(false)
const eventSearch = ref('')
const expandedEvents = ref<Set<string>>(new Set())

const projection = computed(() => inspectComponentSFCPortsSource(props.source, {
  resolveComponentPortManifest: (identity: string) => Endge.program.getArtifact<any>('component-sfc', identity)?.payload?.ir?.script.ports ?? null,
}))
const actions = computed(() => Endge.domain.getActions()
  .filter(action => action.active !== false && Boolean(action.identity?.trim())))
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
const filteredAvailableEvents = computed(() => {
  const query = eventSearch.value.trim().toLowerCase()
  if (!query) {
    return availableEvents.value
  }
  return availableEvents.value.filter(event => (
    event.name.toLowerCase().includes(query)
    || event.displayName.toLowerCase().includes(query)
    || event.payloadType.toLowerCase().includes(query)
    || event.description.toLowerCase().includes(query)
  ))
})
const requiredPorts = computed(() => [
  ...projection.value.manifest.require.actions,
  ...projection.value.manifest.require.computations,
  ...projection.value.manifest.require.components,
])
const providedPorts = computed(() => projection.value.manifest.provides.actions)

const portRole = ref<ComponentSFCPortRole>('require')
const portKind = ref<'action' | 'computation' | 'component'>('action')
const portName = ref('')
const portIdentity = ref('')
const forwardDraft = ref('')
const typescriptDrafts = ref<Record<string, string>>({})

watch(
  () => projection.value.manifest.forward.rules,
  rules => forwardDraft.value = serializeForwardRules(rules),
  { immediate: true, deep: true },
)

function reactionValue(event: ComponentSFCEventPort | null): string {
  if (event?.action?.kind === 'typescript') return '__typescript__'
  return event?.action?.kind === 'action' ? event.action.identity : '__none__'
}

function reactionLabel(event: ComponentSFCEventPort): string {
  const reaction = event.action
  if (reaction?.kind === 'typescript') {
    return 'TypeScript sandbox'
  }
  if (reaction?.kind !== 'action') {
    return 'Без реакции'
  }
  const action = actions.value.find(item => item.identity === reaction.identity)
  return action?.displayName || action?.name || reaction.identity
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

function changeReaction(name: string, payloadType: string, port: ComponentSFCEventPort | null, value: string): void {
  if (value === '__typescript__') {
    typescriptDrafts.value[name] = port?.action?.kind === 'typescript'
      ? (port.action.definitionSource ?? port.action.source)
      : `typescript({\n  inputs: { event: event() },\n  compute({ event }, api) {\n    return api.action('action.identity', event)\n  },\n})`
    return
  }
  if (value === '__none__') {
    applyEvent(name, payloadType, port, null)
    return
  }
  const action = actions.value.find(item => item.identity === value)
  applyEvent(name, payloadType, port, serializeDirectAction(action))
}

function saveTypescript(name: string, payloadType: string, port: ComponentSFCEventPort | null): void {
  applyEvent(name, payloadType, port, typescriptDrafts.value[name] ?? null)
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
  eventPickerOpen.value = false
  eventSearch.value = ''
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
  delete typescriptDrafts.value[name]
}

function addPort(): void {
  const name = portName.value.trim()
  const identity = portIdentity.value.trim()
  if (!name) return
  const role = portRole.value
  const kind = role === 'provides' ? 'action' : portKind.value
  const declaration = kind === 'component'
    ? `component<Record<string, unknown>>({ default: ${JSON.stringify(identity)}, tag: ${JSON.stringify(name)} })`
    : kind === 'computation'
      ? `computation<unknown, unknown>({ default: ${JSON.stringify(identity)} })`
      : role === 'require'
        ? `action<unknown, unknown>({ default: ${JSON.stringify(identity)} })`
        : `action<unknown, unknown>()`
  const result = patchComponentSFCPortsSource(props.source, { type: 'upsert-port', role, name, declaration })
  if (commit(result)) {
    portName.value = ''
    portIdentity.value = ''
  }
}

function removePort(role: ComponentSFCPortRole, name: string): void {
  commit(patchComponentSFCPortsSource(props.source, { type: 'remove-port', role, name }))
}

function saveForward(): void {
  const declaration = forwardDraft.value.trim() || null
  commit(patchComponentSFCPortsSource(props.source, { type: 'set-forward', declaration }))
}

function onEntityDrop(payload: { id: string | number, sectionType: DomainSectionType }): void {
  const entity = payload.sectionType === DomainSectionType.Action
    ? Endge.domain.getActions().find(item => String(item.id) === String(payload.id))
    : payload.sectionType === DomainSectionType.Computation
      ? Endge.domain.getComputations().find(item => String(item.id) === String(payload.id))
      : Endge.domain.getComponentSFCs().find(item => String(item.id) === String(payload.id))
  if (!entity) return
  portIdentity.value = entity.identity
  portName.value = toPortName(entity.identity)
  portRole.value = 'require'
  portKind.value = payload.sectionType === DomainSectionType.Action
    ? 'action'
    : payload.sectionType === DomainSectionType.Computation ? 'computation' : 'component'
}

function serializeDirectAction(action: RAction | undefined): string | null {
  if (!action) return null
  const params = [...(action.input?.params?.values() ?? [])]
  const input = params.length
    ? `{ ${params.map(field => `${field.name}: event(${JSON.stringify(field.name)})`).join(', ')} }`
    : 'event()'
  return `{ identity: ${JSON.stringify(action.identity)}, input: ${input} }`
}

function serializeForwardRules(rules: any[]): string {
  if (!rules.length) return ''
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
  if (simple) return selector.include === '*' ? `'*'` : JSON.stringify(selector.include)
  return `{ include: ${selector.include === '*' ? `'*'` : JSON.stringify(selector.include)}, exclude: ${JSON.stringify(selector.exclude ?? [])}, rename: ${JSON.stringify(selector.rename ?? {})}${selector.namespace && selector.namespace !== 'none' ? `, namespace: ${JSON.stringify(selector.namespace)}` : ''} }`
}

function commit(result: { ok: boolean, source: string, message?: string }): boolean {
  if (!result.ok) return fail(result.message)
  emit('update:source', result.source)
  return true
}

function fail(message?: string): false {
  toast.error('Source не изменён', { description: message || 'Конструкция доступна только в Source-режиме.' })
  return false
}

function toPortName(identity: string): string {
  const tail = identity.split(/[./:-]/).filter(Boolean).at(-1) ?? 'port'
  return tail.replace(/[^A-Z_a-z0-9$]/g, '_').replace(/^\d/, '_$&')
}
</script>

<template>
  <div class="space-y-4 p-5">
    <div v-if="!projection.editable" class="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
      {{ projection.message }} Редактор не будет переписывать этот блок.
    </div>

    <template v-if="mode === 'events'">
      <div class="flex justify-end">
        <Popover v-model:open="eventPickerOpen">
          <PopoverTrigger as-child class="!w-auto">
            <Button
              size="sm"
              :aria-expanded="eventPickerOpen"
              :disabled="!projection.editable || !availableEvents.length"
              @click="eventPickerOpen = !eventPickerOpen"
            >
              <Plus class="mr-1 size-4" />Событие
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-[min(28rem,calc(100vw-2rem))] p-0" align="end" side-offset="6">
            <div class="border-b p-2">
              <Input v-model="eventSearch" class="h-8" placeholder="Найти событие..." @keydown.stop />
            </div>
            <div class="max-h-80 overflow-y-auto p-1.5">
              <button
                v-for="event in filteredAvailableEvents"
                :key="event.name"
                type="button"
                class="flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                @click="addEvent(event.name)"
              >
                <Radio class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span class="min-w-0">
                  <span class="flex flex-wrap items-baseline gap-x-2">
                    <span class="text-sm font-medium">{{ event.displayName }}</span>
                    <span class="font-mono text-xs text-muted-foreground">{{ event.name }}</span>
                  </span>
                  <span class="mt-0.5 block text-xs text-muted-foreground">{{ event.description }}</span>
                  <span class="mt-1 block font-mono text-[11px] text-muted-foreground/80">{{ event.payloadType }}</span>
                </span>
              </button>
              <div v-if="!filteredAvailableEvents.length" class="px-3 py-8 text-center text-sm text-muted-foreground">
                {{ availableEvents.length ? 'Ничего не найдено' : 'Все события уже добавлены' }}
              </div>
            </div>
          </PopoverContent>
        </Popover>
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
              <span class="mt-0.5 block truncate text-xs text-muted-foreground">{{ item.displayName }} · {{ item.payloadType }}</span>
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
          <div class="border-t px-3 pb-3 pt-3">
            <div class="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
              <Label class="self-center text-xs">Реакция</Label>
              <select class="editor-control h-9 rounded-md border bg-background px-2 text-sm" :value="reactionValue(item.port)" :disabled="!projection.editable" @change="changeReaction(item.name, item.payloadType, item.port, ($event.target as HTMLSelectElement).value)">
                <option value="__none__">Без реакции</option>
                <option value="__typescript__">TypeScript sandbox</option>
                <option v-for="action in actions" :key="action.identity" :value="action.identity">{{ action.displayName || action.name || action.identity }}</option>
              </select>
            </div>
            <div v-if="typescriptDrafts[item.name] != null" class="mt-3 space-y-2">
              <Textarea v-model="typescriptDrafts[item.name]" class="min-h-40 font-mono text-xs" />
              <Button size="sm" @click="saveTypescript(item.name, item.payloadType, item.port)">Сохранить sandbox-реакцию</Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </template>

    <template v-else>
      <div class="grid gap-3 xl:grid-cols-2">
        <section class="rounded-lg border p-3">
          <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required</h4>
          <div v-for="port in requiredPorts" :key="`${port.kind}:${port.name}`" class="flex items-center gap-2 border-t py-2 first:border-0">
            <Badge variant="outline">{{ port.kind }}</Badge><span class="font-mono text-xs">{{ port.name }}</span>
            <span class="truncate text-xs text-muted-foreground">{{ 'defaultIdentity' in port ? port.defaultIdentity : '' }}</span>
            <Button class="ml-auto" variant="ghost" size="icon" @click="removePort('require', port.name)"><Trash2 class="size-3.5" /></Button>
          </div>
        </section>
        <section class="rounded-lg border p-3">
          <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Provided</h4>
          <div v-for="port in providedPorts" :key="port.name" class="flex items-center gap-2 border-t py-2 first:border-0">
            <Badge variant="outline">action</Badge><span class="font-mono text-xs">{{ port.name }}</span>
            <Button class="ml-auto" variant="ghost" size="icon" @click="removePort('provides', port.name)"><Trash2 class="size-3.5" /></Button>
          </div>
        </section>
      </div>

      <DomainEntityDropTarget :accept-section-types="[DomainSectionType.Component, DomainSectionType.Action, DomainSectionType.Computation]" hint-text="Перетащите Component, Action или Computation из домена" @entity-drop="onEntityDrop">
        <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <select v-model="portRole" class="editor-control h-9 rounded-md border bg-background px-2 text-sm"><option value="require">Required</option><option value="provides">Provided</option></select>
          <select v-model="portKind" class="editor-control h-9 rounded-md border bg-background px-2 text-sm" :disabled="portRole === 'provides'"><option value="action">Action</option><option value="computation">Computation</option><option value="component">Component</option></select>
          <Input v-model="portName" placeholder="portName" />
          <Input v-model="portIdentity" placeholder="domain.identity" :disabled="portRole === 'provides'" />
          <Button :disabled="!projection.editable" @click="addPort"><Plus class="mr-1 size-4" />Добавить</Button>
        </div>
      </DomainEntityDropTarget>

      <section class="rounded-lg border p-3">
        <h4 class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Radio class="size-3.5" /> Events</h4>
        <div class="mt-2 flex flex-wrap gap-2"><Badge v-for="event in eventPorts" :key="event.name" variant="secondary">{{ event.name }}: {{ event.payloadType }}</Badge></div>
      </section>

      <section class="space-y-2 rounded-lg border p-3">
        <h4 class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Braces class="size-3.5" /> Forwarding</h4>
        <Textarea v-model="forwardDraft" class="min-h-28 font-mono text-xs" placeholder="{ from: 'table', ports: { emits: '*' } }" />
        <Button size="sm" :disabled="!projection.editable" @click="saveForward"><Zap class="mr-1 size-4" />Сохранить forward</Button>
      </section>
    </template>
  </div>
</template>
