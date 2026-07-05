<script setup lang="ts">
import type { EndgeBindingMode } from '@endge/core'

import { Endge } from '@endge/core'
import { useDomainStore } from '@endge/vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import { computed, reactive, watch } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { setPresentationBindingEditorState } from '@/features/endge-ide/model/bindings/presentation-binding-editor-state'

interface PresentationBindingRow {
  id: number | null
  identity: string
  displayName: string
  role: string
  rendererRef: string
  when: string | null
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
  allowedEnvironmentIds?: number[]
}>(), {
  editorModel: null,
  ownerId: null,
  targetType: null,
  targetId: null,
  projectId: null,
  allowedEnvironmentIds: () => [],
})

const domainStore = useDomainStore()
const rows = reactive<PresentationBindingRow[]>([])

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

const rendererOptions = computed(() => {
  const list = domainStore.rendersNames ?? []
  return list.map((key: string) => ({
    value: String(key),
    label: String(key),
  }))
})

const inheritedRows = computed(() => {
  if (!ownerType.value || ownerId.value == null || targetId.value == null)
    return []
  return Endge.presentationBindings.getInheritedBindings({
    ownerType: ownerType.value,
    ownerId: ownerId.value,
    targetType: targetType.value,
    targetId: targetId.value,
  })
})

function toEditableRow(binding: any): PresentationBindingRow {
  const modeRaw = normalizeKey(binding?.mode).toLowerCase()
  const mode: EndgeBindingMode
    = modeRaw === 'append' || modeRaw === 'prepend' || modeRaw === 'disable'
      ? modeRaw
      : 'replace'
  const role = normalizeKey(binding?.role)
  const rendererRef = normalizeKey(binding?.rendererRef)
  return {
    id: normalizeId(binding?.id),
    identity: normalizeKey(binding?.identity),
    displayName: normalizeKey(binding?.displayName) || `${role} -> ${rendererRef}`,
    role,
    rendererRef,
    when: normalizeKey(binding?.when) || null,
    mode,
    priority: Number.isFinite(Number(binding?.priority)) ? Number(binding.priority) : 0,
    isEnabled: binding?.isEnabled !== false,
    environmentId: normalizeId(binding?.environmentId),
    isInherited: binding?.isInherited === true,
    originBindingId: normalizeId(binding?.originBindingId),
  }
}

function createDefaultRow(): PresentationBindingRow {
  const index = rows.length + 1
  const identity = `presentation-binding-${ownerType.value}-${String(ownerId.value ?? 0)}-${Date.now()}-${index}`
  return {
    id: null,
    identity,
    displayName: `Renderer ${index}`,
    role: 'main',
    rendererRef: rendererOptions.value[0]?.value ?? '',
    when: null,
    mode: 'replace',
    priority: 0,
    isEnabled: true,
    environmentId: null,
    isInherited: false,
    originBindingId: null,
  }
}

function loadRowsFromDomain(): void {
  rows.splice(0, rows.length)
  if (!ownerType.value || ownerId.value == null || targetId.value == null)
    return

  const list = domainStore.presentationBindings ?? []
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

  setPresentationBindingEditorState(editorModel, {
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
        role: normalizeKey(row.role),
        rendererRef: normalizeKey(row.rendererRef),
        when: normalizeKey(row.when) || null,
        mode: row.mode,
        priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : 0,
        isEnabled: row.isEnabled === true,
        environmentId: normalizeId(row.environmentId),
        isInherited: false,
        originBindingId: normalizeId(row.originBindingId),
      })),
  })
}

function addPresentationBinding(): void {
  rows.push(createDefaultRow())
}

function removePresentationBinding(index: number): void {
  rows.splice(index, 1)
}

function onEnvironmentChange(row: PresentationBindingRow, value: string): void {
  row.environmentId = value === ENV_BASE ? null : normalizeId(value)
}

function onModeSelect(row: PresentationBindingRow, value: unknown): void {
  const mode = normalizeKey(value).toLowerCase()
  row.mode = mode === 'append' || mode === 'prepend' || mode === 'disable'
    ? mode
    : 'replace'
}

function onEnvironmentSelect(row: PresentationBindingRow, value: unknown): void {
  onEnvironmentChange(row, String(value ?? ENV_BASE))
}

function onEnabledChange(row: PresentationBindingRow, value: unknown): void {
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
        <Label class="text-sm font-semibold">Presentation bindings</Label>
        <p class="text-xs text-muted-foreground">
          Назначение renderer-ов и override-правил для выбранной сущности.
        </p>
      </div>
      <Button size="sm" variant="outline" @click="addPresentationBinding">
        <Plus class="size-3.5 mr-1" />
        Добавить
      </Button>
    </div>

    <div v-if="rows.length === 0" class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
      Presentation bindings пока нет.
    </div>

    <ScrollArea v-else class="max-h-[24rem] rounded-md border">
      <div class="p-3 space-y-3">
        <div
          v-for="(row, index) in rows"
          :key="row.identity || `${index}`"
          class="rounded-md border p-3 space-y-3"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">Role</Label>
              <Input
                v-model="row.role"
                placeholder="main / shell / control / display"
              />
            </div>

            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">RendererRef</Label>
              <SearchableSelect
                :model-value="row.rendererRef"
                :options="rendererOptions"
                placeholder="Выберите renderer"
                @update:model-value="(value) => row.rendererRef = String(value ?? '')"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">When</Label>
              <Input
                :model-value="row.when ?? ''"
                placeholder="опциональное условие"
                @update:model-value="(value) => row.when = String(value ?? '').trim() || null"
              />
            </div>

            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">Название</Label>
              <Input
                v-model="row.displayName"
                placeholder="Название правила"
              />
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
              <Button size="icon" variant="ghost" class="text-destructive" @click="removePresentationBinding(index)">
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
          {{ row.role }} -> {{ row.rendererRef }} · {{ row.mode }} · {{ row.sourceOwnerType }}:{{ row.sourceOwnerId }}
        </div>
      </div>
    </div>
  </div>
</template>
