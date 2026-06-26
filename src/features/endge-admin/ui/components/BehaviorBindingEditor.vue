<script setup lang="ts">
import type { DomainDocumentType, EventContract, EndgeBindingMode } from '@endge/core'

import { DomainSectionType, Endge } from '@endge/core'
import { useDomainStore } from '@endge/vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import { computed, reactive, watch } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getEventContractsForDocument } from '@/features/endge-admin/model/bindings/use-event-contracts'
import { setBehaviorBindingEditorState } from '@/features/endge-admin/model/bindings/behavior-binding-editor-state'
import DomainEntityDropTarget from '@/features/endge-admin/ui/components/DomainEntityDropTarget.vue'

interface BehaviorBindingRow {
  id: number | null
  identity: string
  displayName: string
  eventName: string
  scriptRef: string
  mode: EndgeBindingMode
  priority: number
  isEnabled: boolean
  environmentId: number | null
  isInherited: boolean
  originBindingId: number | null
}

const props = withDefaults(defineProps<{
  editorModel?: object | null
  ownerType: string
  ownerId?: number | null
  targetType?: string | null
  targetId?: number | null
  projectId?: number | null
  documentType?: DomainDocumentType
  allowedEnvironmentIds?: number[]
}>(), {
  editorModel: null,
  ownerId: null,
  targetType: null,
  targetId: null,
  projectId: null,
  documentType: undefined,
  allowedEnvironmentIds: () => [],
})

const domainStore = useDomainStore()

const rows = reactive<BehaviorBindingRow[]>([])

const ENV_BASE = '__base__'
const MODE_OPTIONS: Array<{ value: EndgeBindingMode, label: string }> = [
  { value: 'replace', label: 'replace' },
  { value: 'append', label: 'append' },
  { value: 'prepend', label: 'prepend' },
  { value: 'disable', label: 'disable' },
]

function normalizeKey(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeOwnerType(value: unknown): string {
  const raw = normalizeKey(value).toLowerCase()
  if (raw === 'component' || raw === 'component-table' || raw === 'component-dsl')
    return 'component'
  if (raw === 'query' || raw === 'query-rest' || raw === 'query-gql' || raw === 'query-custom')
    return 'query'
  return raw
}

function normalizeId(value: unknown): number | null {
  if (value == null)
    return null
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : null
  const text = normalizeKey(value)
  if (!text)
    return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

const ownerType = computed(() => normalizeOwnerType(props.ownerType))
const ownerId = computed<number | null>(() => normalizeId(props.ownerId))

const targetType = computed(() => normalizeOwnerType(props.targetType) || ownerType.value)
const targetId = computed<number | null>(() => normalizeId(props.targetId) ?? ownerId.value)

const contracts = computed<EventContract[]>(() => {
  if (!props.documentType)
    return []
  return getEventContractsForDocument(props.documentType)
})

const contractByEvent = computed(() => {
  const map = new Map<string, EventContract>()
  for (const contract of contracts.value)
    map.set(normalizeKey(contract.eventName).toLowerCase(), contract)
  return map
})

const eventOptions = computed(() =>
  contracts.value.map(contract => ({
    value: contract.eventName,
    label: contract.title || contract.eventName,
  })),
)

const environmentAllowedSet = computed(() => {
  const set = new Set<number>()
  for (const id of props.allowedEnvironmentIds ?? []) {
    if (Number.isFinite(Number(id)))
      set.add(Number(id))
  }
  return set
})

const environmentOptions = computed(() => {
  const list = domainStore.environments ?? []
  const hasRestrictions = environmentAllowedSet.value.size > 0
  return list
    .filter((environment: any) => {
      if (!hasRestrictions)
        return true
      const envId = normalizeId(environment?.id)
      return envId != null && environmentAllowedSet.value.has(envId)
    })
    .map((environment: any) => ({
      value: String(normalizeId(environment?.id) ?? ''),
      label: normalizeKey(environment?.displayName) || normalizeKey(environment?.name) || normalizeKey(environment?.identity) || String(environment?.id),
    }))
})

const inheritedRows = computed(() => {
  if (!ownerType.value || ownerId.value == null || targetId.value == null)
    return []
  return Endge.behaviorBindings.getInheritedBindings({
    ownerType: ownerType.value,
    ownerId: ownerId.value,
    targetType: targetType.value,
    targetId: targetId.value,
  })
})

function toEditableRow(binding: any): BehaviorBindingRow {
  const modeRaw = normalizeKey(binding?.mode).toLowerCase()
  const mode: EndgeBindingMode
    = modeRaw === 'append' || modeRaw === 'prepend' || modeRaw === 'disable'
      ? modeRaw
      : 'replace'
  const eventName = normalizeKey(binding?.eventName)
  const scriptRef = normalizeKey(binding?.scriptRef)
  return {
    id: normalizeId(binding?.id),
    identity: normalizeKey(binding?.identity),
    displayName: normalizeKey(binding?.displayName) || `${eventName} -> ${scriptRef}`,
    eventName,
    scriptRef,
    mode,
    priority: Number.isFinite(Number(binding?.priority)) ? Number(binding.priority) : 0,
    isEnabled: binding?.isEnabled !== false,
    environmentId: normalizeId(binding?.environmentId),
    isInherited: binding?.isInherited === true,
    originBindingId: normalizeId(binding?.originBindingId),
  }
}

function createDefaultRow(): BehaviorBindingRow {
  const firstEvent = eventOptions.value[0]?.value ?? ''
  const index = rows.length + 1
  const identity = `binding-${ownerType.value}-${String(ownerId.value ?? 0)}-${Date.now()}-${index}`
  return {
    id: null,
    identity,
    displayName: firstEvent ? `Binding ${firstEvent}` : `Binding ${index}`,
    eventName: firstEvent,
    scriptRef: '',
    mode: 'replace',
    priority: 0,
    isEnabled: true,
    environmentId: null,
    isInherited: false,
    originBindingId: null,
  }
}

function supportsEnvironmentOverride(eventName: string): boolean {
  const contract = contractByEvent.value.get(normalizeKey(eventName).toLowerCase())
  if (!contract)
    return true
  return contract.supportsEnvironmentOverride === true
}

function loadRowsFromDomain(): void {
  rows.splice(0, rows.length)
  if (!ownerType.value || ownerId.value == null || targetId.value == null)
    return

  const list = domainStore.behaviorBindings ?? []
  const loaded = list
    .filter((binding: any) => {
      const bindingOwnerType = normalizeOwnerType(binding?.ownerType)
      if (bindingOwnerType !== ownerType.value)
        return false
      const bindingOwnerId = normalizeId(binding?.ownerId)
      if (bindingOwnerId == null || bindingOwnerId !== ownerId.value)
        return false
      const bindingTargetType = normalizeOwnerType(binding?.targetType)
      if (bindingTargetType && bindingTargetType !== targetType.value)
        return false
      const bindingTargetId = normalizeId(binding?.targetId)
      if (bindingTargetId != null && bindingTargetId !== targetId.value)
        return false
      return binding?.isInherited !== true
    })
    .map(toEditableRow)
    .sort((a, b) => a.priority - b.priority)

  rows.push(...loaded)
}

function syncStateToEditor(): void {
  const editorModel = props.editorModel
  if (!editorModel || typeof editorModel !== 'object')
    return
  if (!ownerType.value || ownerId.value == null || targetId.value == null)
    return

  setBehaviorBindingEditorState(editorModel, {
    ownerType: ownerType.value,
    ownerId: ownerId.value,
    targetType: targetType.value,
    targetId: targetId.value,
    projectId: normalizeId(props.projectId),
    items: rows
      .filter(row => row.isInherited !== true)
      .map(row => ({
        id: normalizeId(row.id),
        identity: normalizeKey(row.identity),
        displayName: normalizeKey(row.displayName),
        eventName: normalizeKey(row.eventName),
        scriptRef: normalizeKey(row.scriptRef),
        mode: row.mode,
        priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : 0,
        isEnabled: row.isEnabled === true,
        environmentId: normalizeId(row.environmentId),
        isInherited: false,
        originBindingId: normalizeId(row.originBindingId),
      })),
  })
}

function addBehaviorBinding(): void {
  rows.push(createDefaultRow())
}

function removeBehaviorBinding(index: number): void {
  rows.splice(index, 1)
}

function onDropAction(row: BehaviorBindingRow, value: unknown): void {
  row.scriptRef = normalizeKey(value)
}

function onEventChange(row: BehaviorBindingRow, value: string): void {
  row.eventName = value
  if (!supportsEnvironmentOverride(value))
    row.environmentId = null
}

function onEnvironmentChange(row: BehaviorBindingRow, value: string): void {
  row.environmentId = value === ENV_BASE ? null : normalizeId(value)
}

function onEventSelect(row: BehaviorBindingRow, value: unknown): void {
  onEventChange(row, String(value ?? ''))
}

function onModeSelect(row: BehaviorBindingRow, value: unknown): void {
  const mode = normalizeKey(value).toLowerCase()
  row.mode = mode === 'append' || mode === 'prepend' || mode === 'disable'
    ? mode
    : 'replace'
}

function onEnvironmentSelect(row: BehaviorBindingRow, value: unknown): void {
  onEnvironmentChange(row, String(value ?? ENV_BASE))
}

function onEnabledChange(row: BehaviorBindingRow, value: unknown): void {
  row.isEnabled = value === true
}

watch(
  () => `${ownerType.value}:${String(ownerId.value ?? '')}:${targetType.value}:${String(targetId.value ?? '')}`,
  () => {
    loadRowsFromDomain()
    syncStateToEditor()
  },
  { immediate: true },
)

watch(rows, () => {
  syncStateToEditor()
}, { deep: true })
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <div class="space-y-1">
        <Label class="text-sm font-semibold">События и биндинги</Label>
        <p class="text-xs text-muted-foreground">
          Биндинги редактируются внутри сущности и не отображаются отдельным узлом домена.
        </p>
      </div>
      <Button size="sm" variant="outline" @click="addBehaviorBinding">
        <Plus class="size-3.5 mr-1" />
        Добавить
      </Button>
    </div>

    <div v-if="rows.length === 0" class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
      Биндингов пока нет.
    </div>

    <ScrollArea v-else class="max-h-[22rem] rounded-md border">
      <div class="p-3 space-y-3">
        <div
          v-for="(row, index) in rows"
          :key="row.identity || `${index}`"
          class="rounded-md border p-3 space-y-3"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">Событие</Label>
              <Select
                v-if="eventOptions.length > 0"
                :model-value="row.eventName"
                @update:model-value="(value) => onEventSelect(row, value)"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="Выберите событие" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="event in eventOptions"
                    :key="event.value"
                    :value="event.value"
                  >
                    {{ event.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Input
                v-else
                v-model="row.eventName"
                placeholder="event-name"
              />
            </div>

            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">ScriptRef (action/runtime id)</Label>
              <DomainEntityDropTarget
                :accept-section-types="[DomainSectionType.Action]"
                :show-hint="false"
                @update:model-value="(value) => onDropAction(row, value)"
              >
                <Input
                  v-model="row.scriptRef"
                  placeholder="action-id"
                />
              </DomainEntityDropTarget>
            </div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">Режим</Label>
              <Select
                :model-value="row.mode"
                @update:model-value="(value) => onModeSelect(row, value)"
              >
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="mode in MODE_OPTIONS"
                    :key="mode.value"
                    :value="mode.value"
                  >
                    {{ mode.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">Priority</Label>
              <Input
                :model-value="String(row.priority)"
                type="number"
                @update:model-value="(value) => row.priority = Number(value || 0)"
              />
            </div>

            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">Окружение</Label>
              <Select
                :model-value="row.environmentId != null ? String(row.environmentId) : ENV_BASE"
                :disabled="!supportsEnvironmentOverride(row.eventName)"
                @update:model-value="(value) => onEnvironmentSelect(row, value)"
              >
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="ENV_BASE">
                    Базовый
                  </SelectItem>
                  <SelectItem
                    v-for="environment in environmentOptions"
                    :key="environment.value"
                    :value="environment.value"
                  >
                    {{ environment.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="flex items-center gap-2 pb-1">
              <Checkbox
                :checked="row.isEnabled"
                @update:checked="onEnabledChange(row, $event)"
              />
              <Label class="text-xs text-muted-foreground">Enabled</Label>
            </div>

            <div class="flex justify-end">
              <Button size="icon" variant="ghost" class="text-destructive" @click="removeBehaviorBinding(index)">
                <Trash2 class="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>

    <div v-if="inheritedRows.length > 0" class="rounded-md border p-3 space-y-2">
      <div class="flex items-center gap-2">
        <Label class="text-sm font-semibold">Унаследованные</Label>
        <Badge variant="outline">{{ inheritedRows.length }}</Badge>
      </div>
      <div class="space-y-1">
        <div
          v-for="row in inheritedRows"
          :key="`inh-${row.identity}-${row.sourceOwnerType}-${row.sourceOwnerId}`"
          class="text-xs text-muted-foreground"
        >
          {{ row.eventName }} -> {{ row.scriptRef }} · {{ row.mode }} · {{ row.sourceOwnerType }}:{{ row.sourceOwnerId }}
        </div>
      </div>
    </div>
  </div>
</template>
