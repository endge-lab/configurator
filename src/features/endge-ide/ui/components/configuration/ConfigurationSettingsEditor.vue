<script setup lang="ts">
import type {
  ComponentSFCInteractionKeyboardCondition,
  ComponentSFCInteractionTrigger,
  EndgeConfiguration,
  EndgeConfigurationContribution,
  EndgeConfigurationPatch,
  EndgeDiagnosticsConfiguration,
  EndgeDiagnosticsConfigurationPatch,
  EndgeTooltipConfiguration,
} from '@endge/core'

import { applyEndgeConfigurationContribution } from '@endge/core'
import { Braces, Clock3, HeartPulse, Languages, MessageSquareText, Palette, PanelsTopLeft, Pencil, Plus, Settings2, ShieldCheck } from 'lucide-vue-next'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSmartTabSelection } from '@/components/ui/smart-tabs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ComponentSFCKeyboardConditionEditor from '@/features/endge-ide/ui/section/document/entity/component-sfc/ComponentSFCKeyboardConditionEditor.vue'

import ConfigurationCollectionRowActions from './ConfigurationCollectionRowActions.vue'
import ConfigurationOverrideField from './ConfigurationOverrideField.vue'
import DiagnosticsConfigurationEditor from './DiagnosticsConfigurationEditor.vue'
import SFCEditingTriggerListEditor from './SFCEditingTriggerListEditor.vue'

type ConfigurationModel = EndgeConfiguration | EndgeConfigurationContribution
type CollectionName = 'vars' | 'locales' | 'themes' | 'timezones' | 'sfcAdapterIds'
type ScalarName = 'defaultLocale' | 'fallbackLocale' | 'defaultTheme' | 'defaultTimezone' | 'defaultAuthProfileIdentity' | 'defaultSfcAdapterId'
type ConfigurationSection = 'general' | 'environment' | 'ui' | 'editing' | 'tooltips' | 'auth' | 'locales' | 'themes' | 'timezones' | 'diagnostics'
type TooltipSection = 'ui' | 'trigger'
type SFCEditingField = 'cancelOn' | 'commitOn'
type TooltipField = keyof EndgeTooltipConfiguration

const props = defineProps<{
  variant: 'root' | 'contribution'
  modelValue: ConfigurationModel
  upstream?: EndgeConfiguration
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ConfigurationModel]
}>()

const EXCLUDED_VALUE_LABEL = 'Исключено из наследования'
const excludedRowDrafts = new WeakMap<object, unknown>()
const activeSection = useSmartTabSelection<ConfigurationSection>(
  'configuration.active-section',
  'general',
  ['general', 'environment', 'ui', 'editing', 'tooltips', 'auth', 'locales', 'themes', 'timezones', 'diagnostics'],
)
const tooltipSection = useSmartTabSelection<TooltipSection>(
  'configuration.tooltips-section',
  'ui',
  ['ui', 'trigger'],
)
const sections = [
  {
    id: 'general',
    label: 'Основное',
    icon: Settings2,
  },
  {
    id: 'environment',
    label: 'Среда',
    icon: Braces,
  },
  {
    id: 'ui',
    label: 'UI',
    icon: PanelsTopLeft,
  },
  {
    id: 'editing',
    label: 'Редактирование',
    icon: Pencil,
  },
  {
    id: 'tooltips',
    label: 'Тултипы',
    icon: MessageSquareText,
  },
  {
    id: 'auth',
    label: 'Авторизация',
    icon: ShieldCheck,
  },
  {
    id: 'locales',
    label: 'Локализация',
    icon: Languages,
  },
  {
    id: 'themes',
    label: 'Темы',
    icon: Palette,
  },
  {
    id: 'timezones',
    label: 'Временные зоны',
    icon: Clock3,
  },
  {
    id: 'diagnostics',
    label: 'Диагностика',
    icon: HeartPulse,
  },
] as const
const tooltipSections = [
  { id: 'ui', label: 'Настройки UI' },
  { id: 'trigger', label: 'Триггер' },
] as const

const contribution = computed(() => props.variant === 'contribution'
  ? props.modelValue as EndgeConfigurationContribution
  : null)
const isInherit = computed(() => contribution.value?.mode === 'inherit')
const patch = computed(() => isInherit.value
  ? (contribution.value as Extract<EndgeConfigurationContribution, { mode: 'inherit' }>).patch
  : null)
const editableConfiguration = computed(() => props.variant === 'root'
  ? props.modelValue as EndgeConfiguration
  : contribution.value?.mode === 'replace'
    ? contribution.value.value
    : props.upstream!)
const effective = computed(() => {
  if (props.variant === 'root')
    return props.modelValue as EndgeConfiguration
  return applyEndgeConfigurationContribution(props.upstream!, props.modelValue as EndgeConfigurationContribution)
})

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function setActiveSection(value: unknown): void {
  if (sections.some(section => section.id === value)) {
    activeSection.value = value as ConfigurationSection
  }
}

function setContributionMode(mode: string): void {
  if (mode === 'replace') {
    emit('update:modelValue', {
      mode: 'replace',
      value: clone(props.upstream!),
    })
    return
  }
  emit('update:modelValue', { mode: 'inherit', patch: {} })
}

function notifyRootMutation(): void {
  emit('update:modelValue', props.modelValue)
}

function hasScalarOverride(name: ScalarName): boolean {
  return patch.value?.[name]?.op === 'set'
}

function scalarValue(name: ScalarName): string {
  if (isInherit.value) {
    const override = patch.value?.[name]
    return override?.op === 'set' ? String(override.value ?? '') : ''
  }
  return String(editableConfiguration.value[name] ?? '')
}

function setScalar(name: ScalarName, value: string): void {
  if (isInherit.value) {
    ;(patch.value as Record<string, unknown>)[name] = { op: 'set', value }
  }
  else {
    ;(editableConfiguration.value as unknown as Record<string, unknown>)[name] = name === 'defaultAuthProfileIdentity' && !value ? null : value
  }
  notifyRootMutation()
}

function enableScalar(name: ScalarName): void {
  setScalar(name, String(props.upstream?.[name] ?? ''))
}

function resetScalar(name: ScalarName): void {
  if (patch.value)
    delete (patch.value as Record<string, unknown>)[name]
  notifyRootMutation()
}

function hasSFCEditingOverride(name: SFCEditingField): boolean {
  return patch.value?.sfcEditing?.[name]?.op === 'set'
}

function sfcEditingTriggers(name: SFCEditingField): ComponentSFCInteractionTrigger[] {
  if (isInherit.value) {
    const override = patch.value?.sfcEditing?.[name]
    return override?.op === 'set' ? override.value : effective.value.sfcEditing[name]
  }
  return editableConfiguration.value.sfcEditing[name]
}

function enableSFCEditingOverride(name: SFCEditingField): void {
  const target = patch.value as EndgeConfigurationPatch
  target.sfcEditing ??= {}
  target.sfcEditing[name] = {
    op: 'set',
    value: clone(props.upstream!.sfcEditing[name]),
  }
  notifyRootMutation()
}

function resetSFCEditingOverride(name: SFCEditingField): void {
  if (!patch.value?.sfcEditing) {
    return
  }
  delete patch.value.sfcEditing[name]
  if (!Object.keys(patch.value.sfcEditing).length) {
    delete patch.value.sfcEditing
  }
  notifyRootMutation()
}

function setSFCEditingTriggers(name: SFCEditingField, value: ComponentSFCInteractionTrigger[]): void {
  if (isInherit.value) {
    if (!hasSFCEditingOverride(name)) {
      return
    }
    patch.value!.sfcEditing![name] = { op: 'set', value: clone(value) }
  }
  else {
    editableConfiguration.value.sfcEditing[name] = clone(value)
  }
  notifyRootMutation()
}

function hasTooltipOverride(name: TooltipField): boolean {
  return patch.value?.tooltips?.[name]?.op === 'set'
}

function tooltipValue(name: TooltipField): EndgeTooltipConfiguration[TooltipField] {
  if (isInherit.value) {
    const override = patch.value?.tooltips?.[name]
    return override?.op === 'set' ? override.value : effective.value.tooltips[name]
  }
  return editableConfiguration.value.tooltips[name]
}

function setTooltipSection(value: unknown): void {
  if (value === 'ui' || value === 'trigger') {
    tooltipSection.value = value
  }
}

function enableTooltipOverride(name: TooltipField): void {
  const target = patch.value as EndgeConfigurationPatch
  target.tooltips ??= {}
  ;(target.tooltips as any)[name] = {
    op: 'set',
    value: name === 'keyboard' ? clone(props.upstream!.tooltips.keyboard ?? {}) : clone(props.upstream!.tooltips[name]),
  }
  notifyRootMutation()
}

function resetTooltipOverride(name: TooltipField): void {
  if (!patch.value?.tooltips) return
  delete patch.value.tooltips[name]
  if (!Object.keys(patch.value.tooltips).length) delete patch.value.tooltips
  notifyRootMutation()
}

function setTooltipValue(name: TooltipField, value: string | number): void {
  const normalized = name === 'openDelay' || name === 'closeDelay'
    ? Math.max(0, Math.min(60_000, Number(value) || 0))
    : value
  if (isInherit.value) {
    if (!hasTooltipOverride(name)) return
    ;(patch.value!.tooltips as any)[name] = { op: 'set', value: normalized }
  }
  else {
    ;(editableConfiguration.value.tooltips as any)[name] = normalized
  }
  notifyRootMutation()
}

function tooltipKeyboard(): ComponentSFCInteractionKeyboardCondition | null {
  return (tooltipValue('keyboard') as ComponentSFCInteractionKeyboardCondition | undefined) ?? null
}

function setTooltipKeyboard(value: ComponentSFCInteractionKeyboardCondition | null): void {
  if (isInherit.value) {
    if (!hasTooltipOverride('keyboard')) {
      return
    }
    patch.value!.tooltips!.keyboard = { op: 'set', value: clone(value ?? {}) }
  }
  else {
    if (value) {
      editableConfiguration.value.tooltips.keyboard = clone(value)
    }
    else {
      delete editableConfiguration.value.tooltips.keyboard
    }
  }
  notifyRootMutation()
}

function collectionRows(name: CollectionName): any[] {
  if (!isInherit.value)
    return editableConfiguration.value[name] as any[]
  return (patch.value?.[name]?.entries ?? []) as any[]
}

function createCollectionValue(name: CollectionName, index: number): unknown {
  if (name === 'vars') return { name: `ENV_VAR_${index + 1}`, defaultValue: '' }
  if (name === 'locales') return { code: `locale-${index + 1}`, displayName: '', shortLabel: '', direction: 'ltr' }
  if (name === 'themes') return { identity: `theme-${index + 1}`, displayName: '' }
  if (name === 'timezones') return { identity: index === 0 ? 'UTC' : `Etc/GMT${index}`, displayName: '' }
  return `adapter-${index + 1}`
}

function collectionKey(name: CollectionName, value: any): string {
  if (name === 'vars') return String(value?.name ?? '')
  if (name === 'locales') return String(value?.code ?? '')
  if (name === 'themes' || name === 'timezones') return String(value?.identity ?? '')
  return String(value ?? '')
}

function ensureCollectionPatch(name: CollectionName): { entries: any[] } {
  const target = patch.value as EndgeConfigurationPatch
  if (!target[name]) {
    ;(target as any)[name] = { entries: [] }
  }
  return target[name] as { entries: any[] }
}

function rowValue(row: any, field: string): string {
  const target = isInherit.value ? row.value : row
  return String(target?.[field] ?? '')
}

function setRowValue(row: any, field: string, value: string): void {
  const target = isInherit.value ? row.value : row
  target[field] = value
  notifyRootMutation()
}

function addCollectionValue(name: CollectionName): void {
  const rows = collectionRows(name)
  const value = createCollectionValue(name, rows.length)
  if (isInherit.value) {
    ensureCollectionPatch(name).entries.push({
      key: collectionKey(name, value),
      op: 'upsert',
      value,
    })
  }
  else {
    ;(editableConfiguration.value[name] as any[]).push(value)
  }
  notifyRootMutation()
}

function removeCollectionRow(name: CollectionName, index: number): void {
  if (isInherit.value)
    ensureCollectionPatch(name).entries.splice(index, 1)
  else
    ;(editableConfiguration.value[name] as any[]).splice(index, 1)
  notifyRootMutation()
}

function isCollectionRowExcluded(row: any): boolean {
  return isInherit.value && row?.op === 'remove'
}

function toggleCollectionRowExclusion(name: CollectionName, row: any): void {
  if (!isInherit.value) {
    return
  }

  if (row.op === 'remove') {
    row.op = 'upsert'
    row.value = excludedRowDrafts.get(row) ?? createCollectionValue(name, collectionRows(name).indexOf(row))
    updateEntryKey(name, row, row.key)
  }
  else {
    excludedRowDrafts.set(row, clone(row.value))
    row.op = 'remove'
    delete row.value
    notifyRootMutation()
  }
}

function updateEntryKey(name: CollectionName, entry: any, value: string): void {
  entry.key = value
  if (entry.op !== 'upsert')
    return
  if (name === 'vars') entry.value.name = value
  else if (name === 'locales') entry.value.code = value
  else if (name === 'themes' || name === 'timezones') entry.value.identity = value
  else entry.value = value
  notifyRootMutation()
}

/** Применяет полную diagnostics model к root/replace или переводит её в минимальный inherit patch. */
function setDiagnosticsConfiguration(value: EndgeDiagnosticsConfiguration): void {
  if (isInherit.value) {
    const diagnosticsPatch = createDiagnosticsPatch(props.upstream!.diagnostics, value)
    if (diagnosticsPatch) {
      patch.value!.diagnostics = diagnosticsPatch
    }
    else {
      delete patch.value!.diagnostics
    }
  }
  else {
    editableConfiguration.value.diagnostics = clone(value)
  }
  notifyRootMutation()
}

/** Строит diagnostics contribution относительно upstream configuration. */
function createDiagnosticsPatch(
  upstream: EndgeDiagnosticsConfiguration,
  value: EndgeDiagnosticsConfiguration,
): EndgeDiagnosticsConfigurationPatch | undefined {
  const collection = compactObject({
    enabled: scalarPatch(upstream.telemetry.collection.enabled, value.telemetry.collection.enabled),
    signals: collectionPatch(upstream.telemetry.collection.signals, value.telemetry.collection.signals, item => item),
    minSeverity: scalarPatch(upstream.telemetry.collection.minSeverity, value.telemetry.collection.minSeverity),
    maxRecords: scalarPatch(upstream.telemetry.collection.maxRecords, value.telemetry.collection.maxRecords),
  })
  const telemetry = compactObject({
    collection: hasKeys(collection) ? collection : undefined,
    outputs: collectionPatch(upstream.telemetry.outputs, value.telemetry.outputs, item => item.id),
    routes: collectionPatch(upstream.telemetry.routes, value.telemetry.routes, item => item.id),
  })
  const content = compactObject({
    telemetry: scalarPatch(upstream.snapshots.content.telemetry, value.snapshots.content.telemetry),
    problems: scalarPatch(upstream.snapshots.content.problems, value.snapshots.content.problems),
    configuration: scalarPatch(upstream.snapshots.content.configuration, value.snapshots.content.configuration),
  })
  const automatic = compactObject({
    enabled: scalarPatch(upstream.snapshots.automatic.enabled, value.snapshots.automatic.enabled),
    errorCount: scalarPatch(upstream.snapshots.automatic.errorCount, value.snapshots.automatic.errorCount),
    windowSeconds: scalarPatch(upstream.snapshots.automatic.windowSeconds, value.snapshots.automatic.windowSeconds),
    cooldownSeconds: scalarPatch(upstream.snapshots.automatic.cooldownSeconds, value.snapshots.automatic.cooldownSeconds),
    outputIds: collectionPatch(upstream.snapshots.automatic.outputIds, value.snapshots.automatic.outputIds, item => item),
  })
  const snapshots = compactObject({
    content: hasKeys(content) ? content : undefined,
    automatic: hasKeys(automatic) ? automatic : undefined,
  })
  const result = compactObject({
    telemetry: hasKeys(telemetry) ? telemetry : undefined,
    snapshots: hasKeys(snapshots) ? snapshots : undefined,
  }) as EndgeDiagnosticsConfigurationPatch
  return hasKeys(result) ? result : undefined
}

/** Создаёт required scalar override только при фактическом отличии. */
function scalarPatch<T>(upstream: T, value: T): { op: 'set', value: T } | undefined {
  return isEqual(upstream, value) ? undefined : { op: 'set', value: clone(value) }
}

/** Строит keyed upsert/remove operations относительно upstream collection. */
function collectionPatch<T>(upstream: T[], value: T[], getKey: (item: T) => string): { entries: any[] } | undefined {
  const upstreamByKey = new Map(upstream.map(item => [getKey(item), item]))
  const valueByKey = new Map(value.map(item => [getKey(item), item]))
  const entries: any[] = []
  for (const [key] of upstreamByKey) {
    if (!valueByKey.has(key)) {
      entries.push({ key, op: 'remove' })
    }
  }
  for (const [key, item] of valueByKey) {
    if (!isEqual(upstreamByKey.get(key), item)) {
      entries.push({ key, op: 'upsert', value: clone(item) })
    }
  }
  return entries.length ? { entries } : undefined
}

/** Удаляет отсутствующие поля из вложенного diagnostics patch. */
function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>
}

/** Проверяет, содержит ли patch хотя бы одну операцию. */
function hasKeys(value: object): boolean {
  return Object.keys(value).length > 0
}

/** Сравнивает JSON-safe configuration values. */
function isEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
    <section
      v-if="variant === 'contribution'"
      class="grid shrink-0 gap-3 rounded-lg border border-border/80 bg-card/80 px-4 py-3 shadow-xs md:grid-cols-[minmax(0,1fr)_18rem] md:items-center"
    >
      <div class="min-w-0">
        <p class="text-sm font-semibold text-foreground">
          Режим конфигурации
        </p>
        <p class="mt-0.5 text-xs leading-5 text-muted-foreground">
          {{ isInherit
            ? 'Наследуем родительскую конфигурацию и сохраняем только локальные уточнения.'
            : 'Полностью заменяем родительскую конфигурацию значениями этого слоя.' }}
        </p>
      </div>
      <Select :model-value="contribution?.mode" :disabled="disabled" @update:model-value="setContributionMode(String($event))">
        <SelectTrigger class="w-full bg-background"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="inherit">Наследовать и уточнить</SelectItem>
          <SelectItem value="replace">Полностью заменить</SelectItem>
        </SelectContent>
      </Select>
    </section>

    <Tabs
      v-model="activeSection"
      orientation="vertical"
      class="flex min-h-0 w-full flex-1 flex-col gap-0 overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs lg:grid lg:grid-cols-[12rem_minmax(0,1fr)]"
    >
      <aside class="hidden min-h-0 overflow-hidden overscroll-none border-r border-border/70 bg-muted/25 lg:flex lg:flex-col">
        <TabsList class="flex h-auto w-full shrink-0 flex-col items-stretch justify-start gap-1 overflow-hidden rounded-none bg-transparent p-2">
          <template v-for="section in sections" :key="section.id">
            <TabsTrigger
              :value="section.id"
              class="group h-9 w-full flex-none justify-start gap-2 rounded-md border-0 border-l-2 border-l-transparent px-2.5 text-left text-sm font-medium shadow-none data-[state=active]:border-l-primary data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <component :is="section.icon" class="size-3.5 shrink-0 text-muted-foreground transition-colors group-data-[state=active]:text-primary" />
              <span>{{ section.label }}</span>
            </TabsTrigger>

            <div
              v-if="section.id === 'tooltips' && activeSection === 'tooltips'"
              class="ml-4 flex flex-col gap-0.5 border-l border-border/70 pl-2"
            >
              <button
                v-for="tooltipItem in tooltipSections"
                :key="tooltipItem.id"
                type="button"
                class="h-7 rounded px-2 text-left text-xs transition-colors hover:bg-background/70 hover:text-foreground"
                :class="tooltipSection === tooltipItem.id ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'"
                @click="setTooltipSection(tooltipItem.id)"
              >
                {{ tooltipItem.label }}
              </button>
            </div>
          </template>
        </TabsList>
      </aside>

      <main class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background/60">
        <div class="border-b border-border/70 px-4 py-3 lg:hidden">
          <Select :model-value="activeSection" @update:model-value="setActiveSection">
            <SelectTrigger class="w-full bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="section in sections" :key="section.id" :value="section.id">
                {{ section.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select v-if="activeSection === 'tooltips'" :model-value="tooltipSection" @update:model-value="setTooltipSection">
            <SelectTrigger class="mt-2 w-full bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="tooltipItem in tooltipSections" :key="tooltipItem.id" :value="tooltipItem.id">
                {{ tooltipItem.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <TabsContent value="general" class="m-0 space-y-6 p-5 outline-none">
            <slot name="general" />
          </TabsContent>

          <TabsContent value="environment" class="m-0 p-5 outline-none">
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <Label>Environment variables</Label>
                <Button size="sm" variant="outline" :disabled="disabled" @click="addCollectionValue('vars')">
                  <Plus class="mr-2 size-4" />Добавить
                </Button>
              </div>
              <div class="rounded-md border">
                <div v-for="(row, index) in collectionRows('vars')" :key="index" class="grid grid-cols-[1fr_1fr_auto] gap-2 border-b p-2 last:border-0">
                  <Input v-if="isInherit" :model-value="row.key" :disabled="disabled" placeholder="Имя переменной" @update:model-value="updateEntryKey('vars', row, String($event ?? ''))" />
                  <Input v-else v-model="row.name" :disabled="disabled" placeholder="Имя переменной" />
                  <Input v-if="!isCollectionRowExcluded(row)" :model-value="rowValue(row, 'defaultValue')" :disabled="disabled" placeholder="Default value" @update:model-value="setRowValue(row, 'defaultValue', String($event ?? ''))" />
                  <Input v-else :model-value="EXCLUDED_VALUE_LABEL" disabled class="text-destructive" />
                  <ConfigurationCollectionRowActions
                    :excluded="isCollectionRowExcluded(row)"
                    :excludable="isInherit"
                    :disabled="disabled"
                    @toggle-excluded="toggleCollectionRowExclusion('vars', row)"
                    @remove="removeCollectionRow('vars', index)"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ui" class="m-0 space-y-6 p-5 outline-none">
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <Label>Доступные SFC-адаптеры</Label>
                <Button size="sm" variant="outline" :disabled="disabled" @click="addCollectionValue('sfcAdapterIds')">
                  <Plus class="mr-2 size-4" />Добавить
                </Button>
              </div>
              <div class="rounded-md border">
                <div v-for="(row, index) in collectionRows('sfcAdapterIds')" :key="index" class="grid grid-cols-[1fr_1fr_auto] gap-2 border-b p-2 last:border-0">
                  <Input v-if="isInherit" :model-value="row.key" :disabled="disabled" placeholder="Adapter id" @update:model-value="updateEntryKey('sfcAdapterIds', row, String($event ?? ''))" />
                  <Input v-else class="col-span-2" :model-value="String(row)" :disabled="disabled" placeholder="Adapter id" @update:model-value="editableConfiguration.sfcAdapterIds[index] = String($event ?? '')" />
                  <Input
                    v-if="isInherit"
                    :model-value="isCollectionRowExcluded(row) ? EXCLUDED_VALUE_LABEL : 'Добавляется или переопределяется'"
                    disabled
                    :class="isCollectionRowExcluded(row) ? 'text-destructive' : 'text-muted-foreground'"
                  />
                  <ConfigurationCollectionRowActions
                    :excluded="isCollectionRowExcluded(row)"
                    :excludable="isInherit"
                    :disabled="disabled"
                    @toggle-excluded="toggleCollectionRowExclusion('sfcAdapterIds', row)"
                    @remove="removeCollectionRow('sfcAdapterIds', index)"
                  />
                </div>
              </div>
            </div>

            <ConfigurationOverrideField label="SFC-адаптер по умолчанию" :uses-parent-value="isInherit" :overridden="hasScalarOverride('defaultSfcAdapterId')" @enable="enableScalar('defaultSfcAdapterId')" @reset="resetScalar('defaultSfcAdapterId')">
              <template #default="{ disabled: fieldDisabled, parentValuePlaceholder }">
                <Input :model-value="scalarValue('defaultSfcAdapterId')" :disabled="disabled || fieldDisabled" :placeholder="fieldDisabled ? parentValuePlaceholder : undefined" @update:model-value="setScalar('defaultSfcAdapterId', String($event ?? ''))" />
              </template>
            </ConfigurationOverrideField>
          </TabsContent>

          <TabsContent value="editing" class="m-0 space-y-5 p-5 outline-none">
            <div>
              <h3 class="text-sm font-semibold text-foreground">Завершение редактирования</h3>
              <p class="mt-1 text-xs leading-5 text-muted-foreground">
                Эти triggers используют SFC editable-узлы без локальных cancel-on и commit-on.
              </p>
            </div>

            <ConfigurationOverrideField
              label="Отмена"
              label-class="font-semibold"
              :uses-parent-value="isInherit"
              :overridden="hasSFCEditingOverride('cancelOn')"
              @enable="enableSFCEditingOverride('cancelOn')"
              @reset="resetSFCEditingOverride('cancelOn')"
            >
              <template #default="{ disabled: fieldDisabled }">
                <SFCEditingTriggerListEditor
                  :model-value="sfcEditingTriggers('cancelOn')"
                  kind="cancel"
                  :disabled="disabled || fieldDisabled"
                  @update:model-value="setSFCEditingTriggers('cancelOn', $event)"
                />
              </template>
            </ConfigurationOverrideField>

            <ConfigurationOverrideField
              label="Сохранение"
              label-class="font-semibold"
              :uses-parent-value="isInherit"
              :overridden="hasSFCEditingOverride('commitOn')"
              @enable="enableSFCEditingOverride('commitOn')"
              @reset="resetSFCEditingOverride('commitOn')"
            >
              <template #default="{ disabled: fieldDisabled }">
                <SFCEditingTriggerListEditor
                  :model-value="sfcEditingTriggers('commitOn')"
                  kind="commit"
                  :disabled="disabled || fieldDisabled"
                  @update:model-value="setSFCEditingTriggers('commitOn', $event)"
                />
              </template>
            </ConfigurationOverrideField>
          </TabsContent>

          <TabsContent value="tooltips" class="m-0 p-5 outline-none">
            <div v-if="tooltipSection === 'ui'" class="space-y-5">
              <div>
                <h3 class="text-sm font-semibold text-foreground">Настройки UI</h3>
                <p class="mt-1 text-xs leading-5 text-muted-foreground">Положение и задержки единого tooltip overlay.</p>
              </div>

              <div class="grid gap-4 md:grid-cols-2">
                <ConfigurationOverrideField label="Предпочтительная сторона" :uses-parent-value="isInherit" :overridden="hasTooltipOverride('side')" @enable="enableTooltipOverride('side')" @reset="resetTooltipOverride('side')">
                  <template #default="{ disabled: fieldDisabled }">
                    <Select :model-value="String(tooltipValue('side'))" :disabled="disabled || fieldDisabled" @update:model-value="setTooltipValue('side', String($event))">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="top">Сверху</SelectItem>
                        <SelectItem value="right">Справа</SelectItem>
                        <SelectItem value="bottom">Снизу</SelectItem>
                        <SelectItem value="left">Слева</SelectItem>
                      </SelectContent>
                    </Select>
                  </template>
                </ConfigurationOverrideField>

                <ConfigurationOverrideField label="Выравнивание" :uses-parent-value="isInherit" :overridden="hasTooltipOverride('align')" @enable="enableTooltipOverride('align')" @reset="resetTooltipOverride('align')">
                  <template #default="{ disabled: fieldDisabled }">
                    <Select :model-value="String(tooltipValue('align'))" :disabled="disabled || fieldDisabled" @update:model-value="setTooltipValue('align', String($event))">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="start">По началу</SelectItem>
                        <SelectItem value="center">По центру</SelectItem>
                        <SelectItem value="end">По концу</SelectItem>
                      </SelectContent>
                    </Select>
                  </template>
                </ConfigurationOverrideField>

                <ConfigurationOverrideField label="Задержка появления, мс" :uses-parent-value="isInherit" :overridden="hasTooltipOverride('openDelay')" @enable="enableTooltipOverride('openDelay')" @reset="resetTooltipOverride('openDelay')">
                  <template #default="{ disabled: fieldDisabled }">
                    <Input type="number" min="0" max="60000" :model-value="String(tooltipValue('openDelay'))" :disabled="disabled || fieldDisabled" @update:model-value="setTooltipValue('openDelay', String($event ?? '0'))" />
                  </template>
                </ConfigurationOverrideField>

                <ConfigurationOverrideField label="Задержка исчезновения, мс" :uses-parent-value="isInherit" :overridden="hasTooltipOverride('closeDelay')" @enable="enableTooltipOverride('closeDelay')" @reset="resetTooltipOverride('closeDelay')">
                  <template #default="{ disabled: fieldDisabled }">
                    <Input type="number" min="0" max="60000" :model-value="String(tooltipValue('closeDelay'))" :disabled="disabled || fieldDisabled" @update:model-value="setTooltipValue('closeDelay', String($event ?? '0'))" />
                  </template>
                </ConfigurationOverrideField>
              </div>
            </div>

            <div v-else class="space-y-5">
              <div>
                <h3 class="text-sm font-semibold text-foreground">Триггер</h3>
                <p class="mt-1 text-xs leading-5 text-muted-foreground">Условие на состояние клавиатуры при наведении или фокусе.</p>
              </div>

              <ConfigurationOverrideField label="Клавиатурное условие появления" :uses-parent-value="isInherit" :overridden="hasTooltipOverride('keyboard')" @enable="enableTooltipOverride('keyboard')" @reset="resetTooltipOverride('keyboard')">
                <template #default="{ disabled: fieldDisabled }">
                  <div class="space-y-2">
                    <ComponentSFCKeyboardConditionEditor
                      :model-value="tooltipKeyboard()"
                      :disabled="disabled || fieldDisabled"
                      @update:model-value="setTooltipKeyboard"
                    />
                    <p class="text-xs text-muted-foreground">Если условие не задано, тултип появляется при обычном наведении или фокусе. Можно записать физическую комбинацию либо настроить её вручную.</p>
                  </div>
                </template>
              </ConfigurationOverrideField>
            </div>
          </TabsContent>

          <TabsContent value="auth" class="m-0 p-5 outline-none">
            <ConfigurationOverrideField label="Профиль авторизации по умолчанию" :uses-parent-value="isInherit" :overridden="hasScalarOverride('defaultAuthProfileIdentity')" @enable="enableScalar('defaultAuthProfileIdentity')" @reset="resetScalar('defaultAuthProfileIdentity')">
              <template #default="{ disabled: fieldDisabled, parentValuePlaceholder }"><Input :model-value="scalarValue('defaultAuthProfileIdentity')" :disabled="disabled || fieldDisabled" :placeholder="fieldDisabled ? parentValuePlaceholder : 'Не задан'" @update:model-value="setScalar('defaultAuthProfileIdentity', String($event ?? ''))" /></template>
            </ConfigurationOverrideField>
          </TabsContent>

          <TabsContent value="locales" class="m-0 space-y-5 p-5 outline-none">
          <div class="grid gap-4 md:grid-cols-2">
            <ConfigurationOverrideField label="Локаль по умолчанию" :uses-parent-value="isInherit" :overridden="hasScalarOverride('defaultLocale')" @enable="enableScalar('defaultLocale')" @reset="resetScalar('defaultLocale')"><template #default="{ disabled: fieldDisabled, parentValuePlaceholder }"><Input :model-value="scalarValue('defaultLocale')" :disabled="disabled || fieldDisabled" :placeholder="fieldDisabled ? parentValuePlaceholder : undefined" @update:model-value="setScalar('defaultLocale', String($event ?? ''))" /></template></ConfigurationOverrideField>
            <ConfigurationOverrideField label="Резервная локаль" :uses-parent-value="isInherit" :overridden="hasScalarOverride('fallbackLocale')" @enable="enableScalar('fallbackLocale')" @reset="resetScalar('fallbackLocale')"><template #default="{ disabled: fieldDisabled, parentValuePlaceholder }"><Input :model-value="scalarValue('fallbackLocale')" :disabled="disabled || fieldDisabled" :placeholder="fieldDisabled ? parentValuePlaceholder : undefined" @update:model-value="setScalar('fallbackLocale', String($event ?? ''))" /></template></ConfigurationOverrideField>
          </div>
          <div class="flex items-center justify-between">
            <Label>Доступные локали</Label>
            <Button size="sm" variant="outline" :disabled="disabled" @click="addCollectionValue('locales')">
              <Plus class="mr-2 size-4" />Добавить
            </Button>
          </div>
          <div class="rounded-md border">
            <div v-for="(row, index) in collectionRows('locales')" :key="index" class="grid grid-cols-[0.7fr_1.4fr_0.7fr_0.8fr_auto] gap-2 border-b p-2 last:border-0">
              <Input v-if="isInherit" :model-value="row.key" :disabled="disabled" placeholder="Код" @update:model-value="updateEntryKey('locales', row, String($event ?? ''))" />
              <Input v-else v-model="row.code" :disabled="disabled" placeholder="Код" />
              <template v-if="!isCollectionRowExcluded(row)">
                <Input :model-value="rowValue(row, 'displayName')" :disabled="disabled" placeholder="Отображение" @update:model-value="setRowValue(row, 'displayName', String($event ?? ''))" />
                <Input :model-value="rowValue(row, 'shortLabel')" :disabled="disabled" placeholder="Кратко" @update:model-value="setRowValue(row, 'shortLabel', String($event ?? ''))" />
                <Select :model-value="rowValue(row, 'direction') || 'ltr'" :disabled="disabled" @update:model-value="setRowValue(row, 'direction', String($event ?? 'ltr'))"><SelectTrigger><SelectValue placeholder="Direction" /></SelectTrigger><SelectContent><SelectItem value="ltr">LTR</SelectItem><SelectItem value="rtl">RTL</SelectItem></SelectContent></Select>
              </template>
              <Input v-else :model-value="EXCLUDED_VALUE_LABEL" disabled class="col-span-3 text-destructive" />
              <ConfigurationCollectionRowActions
                :excluded="isCollectionRowExcluded(row)"
                :excludable="isInherit"
                :disabled="disabled"
                @toggle-excluded="toggleCollectionRowExclusion('locales', row)"
                @remove="removeCollectionRow('locales', index)"
              />
            </div>
          </div>
          </TabsContent>

          <TabsContent value="themes" class="m-0 space-y-5 p-5 outline-none">
          <ConfigurationOverrideField label="Тема по умолчанию" :uses-parent-value="isInherit" :overridden="hasScalarOverride('defaultTheme')" @enable="enableScalar('defaultTheme')" @reset="resetScalar('defaultTheme')"><template #default="{ disabled: fieldDisabled, parentValuePlaceholder }"><Input :model-value="scalarValue('defaultTheme')" :disabled="disabled || fieldDisabled" :placeholder="fieldDisabled ? parentValuePlaceholder : undefined" @update:model-value="setScalar('defaultTheme', String($event ?? ''))" /></template></ConfigurationOverrideField>
          <div class="flex items-center justify-between">
            <Label>Доступные темы</Label>
            <Button size="sm" variant="outline" :disabled="disabled" @click="addCollectionValue('themes')">
              <Plus class="mr-2 size-4" />Добавить
            </Button>
          </div>
          <div class="rounded-md border">
            <div v-for="(row, index) in collectionRows('themes')" :key="index" class="grid grid-cols-[1fr_1fr_auto] gap-2 border-b p-2 last:border-0">
              <Input v-if="isInherit" :model-value="row.key" :disabled="disabled" placeholder="Identity" @update:model-value="updateEntryKey('themes', row, String($event ?? ''))" />
              <Input v-else v-model="row.identity" :disabled="disabled" placeholder="Identity" />
              <Input v-if="!isCollectionRowExcluded(row)" :model-value="rowValue(row, 'displayName')" :disabled="disabled" placeholder="Отображение" @update:model-value="setRowValue(row, 'displayName', String($event ?? ''))" />
              <Input v-else :model-value="EXCLUDED_VALUE_LABEL" disabled class="text-destructive" />
              <ConfigurationCollectionRowActions
                :excluded="isCollectionRowExcluded(row)"
                :excludable="isInherit"
                :disabled="disabled"
                @toggle-excluded="toggleCollectionRowExclusion('themes', row)"
                @remove="removeCollectionRow('themes', index)"
              />
            </div>
          </div>
          <div class="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">Effective: {{ effective.locales.length }} locales, {{ effective.themes.length }} themes, default theme — {{ effective.defaultTheme }}.</div>
          </TabsContent>

          <TabsContent value="timezones" class="m-0 space-y-5 p-5 outline-none">
            <ConfigurationOverrideField label="Временная зона по умолчанию" :uses-parent-value="isInherit" :overridden="hasScalarOverride('defaultTimezone')" @enable="enableScalar('defaultTimezone')" @reset="resetScalar('defaultTimezone')">
              <template #default="{ disabled: fieldDisabled, parentValuePlaceholder }">
                <Select :model-value="scalarValue('defaultTimezone')" :disabled="disabled || fieldDisabled" @update:model-value="setScalar('defaultTimezone', String($event ?? ''))">
                  <SelectTrigger><SelectValue :placeholder="fieldDisabled ? parentValuePlaceholder : 'Выберите временную зону'" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="timezone in effective.timezones" :key="timezone.identity" :value="timezone.identity">
                      {{ timezone.displayName || timezone.identity }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </template>
            </ConfigurationOverrideField>
            <div class="flex items-center justify-between">
              <div>
                <Label>Доступные временные зоны</Label>
                <p class="mt-1 text-xs text-muted-foreground">Используйте IANA identity или системное значение local.</p>
              </div>
              <Button size="sm" variant="outline" :disabled="disabled" @click="addCollectionValue('timezones')">
                <Plus class="mr-2 size-4" />Добавить
              </Button>
            </div>
            <div class="rounded-md border">
              <div v-for="(row, index) in collectionRows('timezones')" :key="index" class="grid grid-cols-[1fr_1fr_auto] gap-2 border-b p-2 last:border-0">
                <Input v-if="isInherit" :model-value="row.key" :disabled="disabled" placeholder="IANA identity" @update:model-value="updateEntryKey('timezones', row, String($event ?? ''))" />
                <Input v-else v-model="row.identity" :disabled="disabled" placeholder="IANA identity" />
                <Input v-if="!isCollectionRowExcluded(row)" :model-value="rowValue(row, 'displayName')" :disabled="disabled" placeholder="Отображаемое имя" @update:model-value="setRowValue(row, 'displayName', String($event ?? ''))" />
                <Input v-else :model-value="EXCLUDED_VALUE_LABEL" disabled class="text-destructive" />
                <ConfigurationCollectionRowActions
                  :excluded="isCollectionRowExcluded(row)"
                  :excludable="isInherit"
                  :disabled="disabled"
                  @toggle-excluded="toggleCollectionRowExclusion('timezones', row)"
                  @remove="removeCollectionRow('timezones', index)"
                />
              </div>
            </div>
            <div class="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">Effective: {{ effective.timezones.length }} zones, default — {{ effective.defaultTimezone }}.</div>
          </TabsContent>

          <TabsContent value="diagnostics" class="m-0 min-h-full p-0 outline-none">
            <DiagnosticsConfigurationEditor
              :model-value="effective.diagnostics"
              :variant="variant"
              :disabled="disabled"
              @update:model-value="setDiagnosticsConfiguration"
            />
          </TabsContent>
        </div>
      </main>
    </Tabs>
  </div>
</template>
