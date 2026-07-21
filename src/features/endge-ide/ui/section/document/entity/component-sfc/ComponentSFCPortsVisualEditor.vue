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
import { Braces, Plus, Radio, Trash2, Unplug, Zap } from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

const projection = computed(() => inspectComponentSFCPortsSource(props.source, {
  resolveComponentPortManifest: (identity: string) => Endge.program.getArtifact<any>('component-sfc', identity)?.payload?.ir?.script.ports ?? null,
}))
const actions = computed(() => Endge.domain.getActions()
  .filter(action => action.active !== false && Boolean(action.identity?.trim())))
const eventPorts = computed(() => projection.value.manifest.emits.events)
const tableEvents = computed(() => TABLE_EVENT_DEFINITIONS.map(definition => ({
  ...definition,
  port: eventPorts.value.find(event => event.name === definition.name) ?? null,
})))
const ownEvents = computed(() => eventPorts.value.filter(event => !TABLE_EVENT_DEFINITIONS.some(definition => definition.name === event.name)))
const requiredPorts = computed(() => [
  ...projection.value.manifest.require.actions,
  ...projection.value.manifest.require.computations,
  ...projection.value.manifest.require.components,
])
const providedPorts = computed(() => projection.value.manifest.provides.actions)

const customEventName = ref('')
const customEventType = ref('unknown')
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

function eventOrigin(event: ComponentSFCEventPort | null, intrinsic = false): string {
  if (!event) return intrinsic ? 'Built-in Table' : 'Не объявлен'
  if (event.forwardedFrom) return `Forward: ${event.forwardedFrom.ref ?? event.forwardedFrom.componentTag}`
  if (event.from) return `Table ref=${event.from.ref}`
  return 'Собственное событие'
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

function applyEvent(name: string, payloadType: string, port: ComponentSFCEventPort | null, actionSource: string | null): void {
  let source = props.source
  let refName = port?.from?.ref ?? props.tableRef?.trim() ?? ''
  const isIntrinsic = TABLE_EVENT_DEFINITIONS.some(definition => definition.name === name)
  if (isIntrinsic && !port?.from && !port?.forwardedFrom) {
    if (!refName) {
      refName = 'table'
      const tablePatch = patchComponentSFCTableSource(source, { type: 'set-table-attribute', name: 'ref', value: refName })
      if (!tablePatch.ok) {
        fail(tablePatch.message)
        return
      }
      source = tablePatch.source
    }
  }
  const result = patchComponentSFCPortsSource(source, {
    type: 'set-event',
    name,
    payloadType,
    from: port?.forwardedFrom ? null : (port?.from ?? (isIntrinsic ? { ref: refName, event: name } : null)),
    actionSource,
  })
  commit(result)
}

function addOwnEvent(): void {
  const name = customEventName.value.trim()
  if (!name) return
  const result = patchComponentSFCPortsSource(props.source, {
    type: 'set-event',
    name,
    payloadType: customEventType.value.trim() || 'unknown',
  })
  if (commit(result)) {
    customEventName.value = ''
    customEventType.value = 'unknown'
  }
}

function removeEvent(name: string): void {
  commit(patchComponentSFCPortsSource(props.source, { type: 'remove-port', role: 'emits', name }))
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
      <div class="space-y-1">
        <h3 class="flex items-center gap-2 text-sm font-semibold"><Radio class="size-4" /> События Table</h3>
        <p class="text-xs text-muted-foreground">Event всегда публикуется. Выбранный Action — дополнительная реакция Source.</p>
      </div>

      <div v-for="item in tableEvents" :key="item.name" class="editor-panel rounded-lg border p-3">
        <div class="flex flex-wrap items-start gap-2">
          <div class="min-w-0 flex-1">
            <div class="font-mono text-sm">{{ item.name }}</div>
            <div class="mt-1 text-xs text-muted-foreground">{{ item.payloadType }} · {{ eventOrigin(item.port, true) }}</div>
          </div>
          <Badge v-if="item.port" variant="secondary">опубликован</Badge>
          <Button v-if="item.port?.sourceRange" variant="ghost" size="icon" class="size-7" @click="removeEvent(item.name)"><Trash2 class="size-3.5" /></Button>
        </div>
        <div class="mt-3 grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
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

      <div class="editor-panel rounded-lg border border-dashed p-3">
        <h4 class="text-sm font-medium">Собственное Event компонента</h4>
        <div class="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input v-model="customEventName" placeholder="detailsOpened" />
          <Input v-model="customEventType" placeholder="{ id: string }" />
          <Button :disabled="!projection.editable" @click="addOwnEvent"><Plus class="mr-1 size-4" />Добавить</Button>
        </div>
      </div>

      <div v-for="event in ownEvents" :key="event.name" class="flex items-center gap-2 rounded-md border px-3 py-2">
        <span class="font-mono text-sm">{{ event.name }}</span>
        <Badge variant="outline">{{ event.payloadType }}</Badge>
        <span class="text-xs text-muted-foreground">{{ eventOrigin(event) }}</span>
        <Button class="ml-auto" variant="ghost" size="icon" @click="removeEvent(event.name)"><Trash2 class="size-3.5" /></Button>
      </div>
    </template>

    <template v-else>
      <div class="space-y-1">
        <h3 class="flex items-center gap-2 text-sm font-semibold"><Unplug class="size-4" /> Типизированные порты</h3>
        <p class="text-xs text-muted-foreground">Required, Provided, Events и Forwarding читаются из definePorts и сразу патчат Source.</p>
      </div>

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
