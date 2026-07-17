<script setup lang="ts">
import type {
  EndgeConfiguration,
  EndgeConfigurationContribution,
  EndgeConfigurationPatch,
} from '@endge/core'

import { applyEndgeConfigurationContribution } from '@endge/core'
import { Plus } from 'lucide-vue-next'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import ConfigurationCollectionRowActions from './ConfigurationCollectionRowActions.vue'
import ConfigurationOverrideField from './ConfigurationOverrideField.vue'

type ConfigurationModel = EndgeConfiguration | EndgeConfigurationContribution
type CollectionName = 'vars' | 'locales' | 'themes' | 'sfcAdapterIds'
type ScalarName = 'defaultLocale' | 'fallbackLocale' | 'defaultTheme' | 'defaultAuthProfileIdentity' | 'defaultSfcAdapterId'

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

function sseUrl(): string {
  if (isInherit.value) {
    const override = patch.value?.sse
    return override?.op === 'set' ? override.value.url : ''
  }
  return editableConfiguration.value.sse?.url ?? ''
}

function hasSSEOverride(): boolean {
  return patch.value?.sse != null
}

function setSSEUrl(url: string): void {
  const current = isInherit.value
    ? patch.value?.sse?.op === 'set' ? patch.value.sse.value : props.upstream?.sse
    : editableConfiguration.value.sse
  const next = { url, authMode: current?.authMode ?? 'inherit' as const }
  if (isInherit.value)
    patch.value!.sse = { op: 'set', value: next }
  else
    editableConfiguration.value.sse = next
  notifyRootMutation()
}

function enableSSE(): void {
  setSSEUrl(props.upstream?.sse?.url ?? '')
}

function resetSSE(): void {
  if (patch.value)
    delete patch.value.sse
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
  return `adapter-${index + 1}`
}

function collectionKey(name: CollectionName, value: any): string {
  if (name === 'vars') return String(value?.name ?? '')
  if (name === 'locales') return String(value?.code ?? '')
  if (name === 'themes') return String(value?.identity ?? '')
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
  else if (name === 'themes') entry.value.identity = value
  else entry.value = value
  notifyRootMutation()
}
</script>

<template>
  <div class="space-y-4">
    <Card v-if="variant === 'contribution'" class="rounded-md">
      <CardHeader class="pb-3">
        <CardTitle class="text-base">Режим конфигурации</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3">
        <Select :model-value="contribution?.mode" :disabled="disabled" @update:model-value="setContributionMode(String($event))">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="inherit">Наследовать и уточнить</SelectItem>
            <SelectItem value="replace">Полностью заменить</SelectItem>
          </SelectContent>
        </Select>
        <p class="text-xs text-muted-foreground">
          {{ isInherit ? 'Сохраняются только локальные операции.' : 'Upstream configuration полностью сбрасывается.' }}
        </p>
      </CardContent>
    </Card>

    <Tabs default-value="general" class="w-full">
      <TabsList class="grid w-full grid-cols-4">
        <TabsTrigger value="general">Общие</TabsTrigger>
        <TabsTrigger value="auth">Авторизация</TabsTrigger>
        <TabsTrigger value="locales">Локализация</TabsTrigger>
        <TabsTrigger value="themes">Темы</TabsTrigger>
      </TabsList>

      <TabsContent value="general" class="space-y-4">
        <Card class="rounded-md"><CardContent class="space-y-4 pt-6">
          <ConfigurationOverrideField label="SSE endpoint" :inherited="isInherit" :overridden="hasSSEOverride()" @enable="enableSSE" @reset="resetSSE">
            <template #default="{ disabled: fieldDisabled, inheritedPlaceholder }">
              <Input :model-value="sseUrl()" :disabled="disabled || fieldDisabled" :placeholder="fieldDisabled ? inheritedPlaceholder : '{ENDPOINT_SSE}'" @update:model-value="setSSEUrl(String($event ?? ''))" />
            </template>
          </ConfigurationOverrideField>

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

          <ConfigurationOverrideField label="SFC-адаптер по умолчанию" :inherited="isInherit" :overridden="hasScalarOverride('defaultSfcAdapterId')" @enable="enableScalar('defaultSfcAdapterId')" @reset="resetScalar('defaultSfcAdapterId')">
            <template #default="{ disabled: fieldDisabled, inheritedPlaceholder }">
              <Input :model-value="scalarValue('defaultSfcAdapterId')" :disabled="disabled || fieldDisabled" :placeholder="fieldDisabled ? inheritedPlaceholder : undefined" @update:model-value="setScalar('defaultSfcAdapterId', String($event ?? ''))" />
            </template>
          </ConfigurationOverrideField>

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
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="auth">
        <Card class="rounded-md"><CardContent class="pt-6">
          <ConfigurationOverrideField label="Профиль авторизации по умолчанию" :inherited="isInherit" :overridden="hasScalarOverride('defaultAuthProfileIdentity')" @enable="enableScalar('defaultAuthProfileIdentity')" @reset="resetScalar('defaultAuthProfileIdentity')">
            <template #default="{ disabled: fieldDisabled, inheritedPlaceholder }"><Input :model-value="scalarValue('defaultAuthProfileIdentity')" :disabled="disabled || fieldDisabled" :placeholder="fieldDisabled ? inheritedPlaceholder : 'Не задан'" @update:model-value="setScalar('defaultAuthProfileIdentity', String($event ?? ''))" /></template>
          </ConfigurationOverrideField>
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="locales" class="space-y-4">
        <Card class="rounded-md"><CardContent class="space-y-4 pt-6">
          <div class="grid gap-4 md:grid-cols-2">
            <ConfigurationOverrideField label="Локаль по умолчанию" :inherited="isInherit" :overridden="hasScalarOverride('defaultLocale')" @enable="enableScalar('defaultLocale')" @reset="resetScalar('defaultLocale')"><template #default="{ disabled: fieldDisabled, inheritedPlaceholder }"><Input :model-value="scalarValue('defaultLocale')" :disabled="disabled || fieldDisabled" :placeholder="fieldDisabled ? inheritedPlaceholder : undefined" @update:model-value="setScalar('defaultLocale', String($event ?? ''))" /></template></ConfigurationOverrideField>
            <ConfigurationOverrideField label="Резервная локаль" :inherited="isInherit" :overridden="hasScalarOverride('fallbackLocale')" @enable="enableScalar('fallbackLocale')" @reset="resetScalar('fallbackLocale')"><template #default="{ disabled: fieldDisabled, inheritedPlaceholder }"><Input :model-value="scalarValue('fallbackLocale')" :disabled="disabled || fieldDisabled" :placeholder="fieldDisabled ? inheritedPlaceholder : undefined" @update:model-value="setScalar('fallbackLocale', String($event ?? ''))" /></template></ConfigurationOverrideField>
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
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="themes" class="space-y-4">
        <Card class="rounded-md"><CardContent class="space-y-4 pt-6">
          <ConfigurationOverrideField label="Тема по умолчанию" :inherited="isInherit" :overridden="hasScalarOverride('defaultTheme')" @enable="enableScalar('defaultTheme')" @reset="resetScalar('defaultTheme')"><template #default="{ disabled: fieldDisabled, inheritedPlaceholder }"><Input :model-value="scalarValue('defaultTheme')" :disabled="disabled || fieldDisabled" :placeholder="fieldDisabled ? inheritedPlaceholder : undefined" @update:model-value="setScalar('defaultTheme', String($event ?? ''))" /></template></ConfigurationOverrideField>
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
        </CardContent></Card>
      </TabsContent>
    </Tabs>
  </div>
</template>
