<script setup lang="ts">
import type { FilterFieldItemSchema } from '@endge/core'

import { DomainSectionType, Endge } from '@endge/core'
import { Clock, Filter, GripVertical, ListChecks, Loader2, Plus, Save, Trash2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import DomainEntityDropTarget from '@/features/endge-ide/ui/components/DomainEntityDropTarget.vue'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import PresentationBindingEditor from '@/features/endge-ide/ui/components/PresentationBindingEditor.vue'

/** Редактор из табов - реактивный (documentEditorModel), иначе выбор словарей не обновляет UI */
const tabs = EndgeIDE.tabs
type EditorWithSelection = { id: number | string; identity: string; displayName: string; fields: FilterFieldItemSchema[]; selectedFieldIndex?: number | null }
const editor = computed(() => (tabs.documentEditorModel.value as EditorWithSelection | null) ?? null)
const fields = computed(() => editor.value?.fields ?? [])

const selectedIndex = ref<number | null>(null)
const dragFieldIndex = ref<number | null>(null)
const dragOverFieldIndex = ref<number | null>(null)

/** Синхронизация выбранного индекса с редактором (инспектор читает для примера словаря) */
watch(editor, (ed) => {
  const idx = ed?.selectedFieldIndex
  if (typeof idx === 'number' && idx >= 0) selectedIndex.value = idx
  else if (ed) selectedIndex.value = null
}, { immediate: true })
watch(selectedIndex, (idx) => {
  const ed = editor.value
  if (ed && 'selectedFieldIndex' in ed) (ed as EditorWithSelection).selectedFieldIndex = idx ?? null
}, { flush: 'sync' })

const selectedField = computed(() => {
  const idx = selectedIndex.value
  const arr = fields.value
  if (idx == null || idx < 0 || !arr?.length || idx >= arr.length) return null
  return arr[idx]
})

/** Чекбокс «Активно» - привязка через model-value для корректной реактивности */
const activeChecked = computed({
  get: () => editor.value?.fields?.[selectedIndex.value ?? -1]?.active === true,
  set: (v: boolean) => {
    if (selectedIndex.value != null) updateField(selectedIndex.value, 'active', v)
  },
})

/** Наборы словарей из settings.general.vocabs */
const vocabSets = computed(() => {
  const general = Endge.domain.getSetting('general') as { vocabs?: Array<{ identity: string; collections?: Array<{ name: string }> }> } | null
  return Array.isArray(general?.vocabs) ? general.vocabs : []
})

const vocabIdentityOptions = computed(() =>
  vocabSets.value.map(v => ({ value: v.identity, label: v.identity })),
)

function getVocabCollectionOptions(vocabIdentity: string | undefined) {
  if (!vocabIdentity) return []
  const set = vocabSets.value.find(v => v.identity === vocabIdentity)
  const cols = Array.isArray(set?.collections) ? set.collections : []
  return cols.map(c => ({ value: c.name, label: c.name }))
}


const isDateLikeMode = (mode: string) => mode === 'date' || mode === 'time' || mode === 'datetime'

/** Список конвертеров домена для выбора в поле */
const converterOptions = computed(() => {
  const list = Endge.domain.getConverters()
  return list.map(c => ({
    value: String(c.identity ?? c.id),
    label: c.name ?? String(c.identity ?? c.id),
  }))
})

/** Текущий массив identity конвертеров выбранного поля (нормализованный) */
const selectedConverterIds = computed(() => {
  const f = selectedField.value
  if (!f) return []
  const raw = f.converterIdentities
  if (Array.isArray(raw)) return raw.map((c: any) => (typeof c === 'string' ? c : c?.identity)).filter(Boolean)
  return []
})

function addConverterToField(converterIdentity: string): void {
  if (selectedIndex.value == null || !editor.value?.fields?.[selectedIndex.value]) return
  const ids = selectedConverterIds.value
  if (ids.includes(converterIdentity)) return
  const next = [...ids, converterIdentity]
  updateField(selectedIndex.value, 'converterIdentities', next)
}

function removeConverterFromField(at: number): void {
  if (selectedIndex.value == null) return
  const ids = selectedConverterIds.value.filter((_, i) => i !== at)
  updateField(selectedIndex.value, 'converterIdentities', ids)
}

function setDefaultToToday(): void {
  if (selectedIndex.value == null || !editor.value?.fields?.[selectedIndex.value]) return
  updateField(selectedIndex.value, 'defaultValue', '+0d')
}

function setDefaultToRelative(days: number): void {
  if (selectedIndex.value == null || !editor.value?.fields?.[selectedIndex.value]) return
  const sign = days >= 0 ? '+' : '-'
  updateField(selectedIndex.value, 'defaultValue', `${sign}${Math.abs(days)}d`)
}

function fieldSummary(field: FilterFieldItemSchema): string {
  return field.label || '-'
}

function addField(): void {
  if (!editor.value) return
  const arr = editor.value.fields
  const newField: FilterFieldItemSchema = {
    key: `field_${arr.length + 1}`,
    mode: 'static',
    defaultValue: '*',
    active: true,
    multiple: true,
    converterIdentities: [],
  }
  editor.value.fields.push(newField)
  selectedIndex.value = editor.value.fields.length - 1
}

function removeField(index: number): void {
  if (!editor.value || index < 0 || index >= editor.value.fields.length) return
  editor.value.fields.splice(index, 1)
  if (selectedIndex.value === index) selectedIndex.value = null
  else if (selectedIndex.value != null && selectedIndex.value > index) selectedIndex.value -= 1
}

function moveField(fromIndex: number, toIndex: number): void {
  if (!editor.value || fromIndex === toIndex) return
  const arr = editor.value.fields
  if (fromIndex < 0 || fromIndex >= arr.length || toIndex < 0 || toIndex >= arr.length) return
  const [item] = arr.splice(fromIndex, 1)
  arr.splice(toIndex, 0, item)
  if (selectedIndex.value === fromIndex) selectedIndex.value = toIndex
  else if (selectedIndex.value != null && selectedIndex.value > fromIndex && selectedIndex.value <= toIndex) selectedIndex.value -= 1
  else if (selectedIndex.value != null && selectedIndex.value >= toIndex && selectedIndex.value < fromIndex) selectedIndex.value += 1
}

function onFieldDragStart(e: DragEvent, index: number): void {
  dragFieldIndex.value = index
  dragOverFieldIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}

function onFieldDragOver(e: DragEvent, index: number): void {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverFieldIndex.value = index
}

function onFieldDragLeave(): void {
  dragOverFieldIndex.value = null
}

function onFieldDrop(e: DragEvent, dropIndex: number): void {
  e.preventDefault()
  const from = dragFieldIndex.value
  if (from == null) {
    dragFieldIndex.value = null
    dragOverFieldIndex.value = null
    return
  }
  if (from !== dropIndex) moveField(from, dropIndex)
  dragFieldIndex.value = null
  dragOverFieldIndex.value = null
}

function onFieldDragEnd(): void {
  dragFieldIndex.value = null
  dragOverFieldIndex.value = null
}

function updateField<K extends keyof FilterFieldItemSchema>(index: number, key: K, value: FilterFieldItemSchema[K]): void {
  if (!editor.value || index < 0 || index >= editor.value.fields.length) return
  editor.value.fields[index] = { ...editor.value.fields[index], [key]: value }
}

function onModeChange(newMode: FilterFieldItemSchema['mode']): void {
  if (selectedIndex.value == null) return
  const cur = selectedField.value?.defaultValue ?? '*'
  updateField(selectedIndex.value, 'mode', newMode)
  if (isDateLikeMode(newMode) && (cur === '*' || cur === '')) {
    updateField(selectedIndex.value, 'defaultValue', '+0d')
  }
}

function onVocabIdentityChange(index: number, newIdentity: string): void {
  if (!editor.value || index < 0 || index >= editor.value.fields.length) return
  const opts = getVocabCollectionOptions(newIdentity)
  const firstCollection = opts[0]?.value ?? ''
  editor.value.fields[index] = {
    ...editor.value.fields[index],
    vocabIdentity: newIdentity,
    vocabCollection: firstCollection,
  }
}

/** Текущий массив опций статического списка выбранного поля */
const selectedStaticOptions = computed(() => {
  const f = selectedField.value
  const raw = f?.staticOptions
  return Array.isArray(raw) ? raw : []
})

function addStaticOption(): void {
  if (selectedIndex.value == null || !editor.value?.fields?.[selectedIndex.value]) return
  const opts = [...selectedStaticOptions.value, { value: '', label: '' }]
  updateField(selectedIndex.value, 'staticOptions', opts)
}

function removeStaticOption(optIndex: number): void {
  if (selectedIndex.value == null) return
  const opts = selectedStaticOptions.value.filter((_, i) => i !== optIndex)
  updateField(selectedIndex.value, 'staticOptions', opts)
}

function updateStaticOption(optIndex: number, key: 'value' | 'label', val: string): void {
  if (selectedIndex.value == null) return
  const opts = selectedStaticOptions.value.map((opt, i) =>
    i === optIndex ? { ...opt, [key]: val } : opt,
  )
  updateField(selectedIndex.value, 'staticOptions', opts)
}

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <div class="p-3 border-b flex items-center gap-3 shrink-0">
      <div class="size-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
        <Filter class="size-4 text-blue-500" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="min-w-0">
          <div class="text-lg font-semibold truncate">
            Фильтр - {{ editor?.displayName ?? '-' }}
          </div>
          <div class="text-xs text-muted-foreground truncate">
            id: {{ editor?.id ?? '-' }} · identity: {{ editor?.identity ?? '-' }}
          </div>
        </div>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" aria-label="Сохранить" :disabled="EndgeIDE.busy.value" @click="save">
              <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
              <Save v-else class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Сохранить</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>

    <div class="flex-1 min-h-0 flex flex-col gap-3 p-3">
      <!-- Список полей сверху -->
      <Card class="shrink-0">
        <div class="p-2 border-b flex items-center justify-between gap-2 flex-wrap">
          <span class="text-xs font-medium flex items-center gap-1">
            <ListChecks class="size-3.5" />
            Поля фильтра
          </span>
          <Button variant="outline" size="sm" class="h-7" @click="addField">
            <Plus class="size-3.5 mr-1" />
            Добавить
          </Button>
        </div>
        <div class="p-2 flex flex-wrap gap-1">
          <button
            v-for="(field, index) in fields"
            :key="index"
            type="button"
            draggable="true"
            class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs transition-colors border cursor-move"
            :class="[
              selectedIndex === index ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted border-transparent',
              dragFieldIndex === index ? 'opacity-50' : '',
              dragOverFieldIndex === index && dragFieldIndex !== index ? 'ring-1 ring-primary' : '',
            ]"
            :title="fieldSummary(field)"
            @click="selectedIndex = index"
            @dragstart="(e: DragEvent) => onFieldDragStart(e, index)"
            @dragover="(e: DragEvent) => onFieldDragOver(e, index)"
            @dragleave="onFieldDragLeave"
            @drop="(e: DragEvent) => onFieldDrop(e, index)"
            @dragend="onFieldDragEnd"
          >
            <GripVertical class="size-3.5 shrink-0 opacity-60" />
            {{ fieldSummary(field) }}
          </button>
          <div v-if="fields.length === 0" class="px-3 py-2 text-xs text-muted-foreground">
            Нет полей. Нажмите «Добавить».
          </div>
        </div>
      </Card>

      <!-- Детальная форма выбранного поля (ниже) -->
      <Card class="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ScrollArea class="flex-1">
          <div v-if="selectedField === null" class="p-8 text-sm text-muted-foreground text-center">
            Выберите поле в списке или добавьте новое
          </div>
          <div v-else class="p-4 space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label>Ключ</Label>
                <Input
                  v-if="selectedIndex !== null"
                  :model-value="selectedField?.key ?? ''"
                  @update:model-value="(v) => selectedIndex != null && updateField(selectedIndex, 'key', String(v ?? ''))"
                />
              </div>
              <div class="space-y-2">
                <Label>Label</Label>
                <Input
                  v-if="selectedIndex !== null"
                  :model-value="selectedField?.label ?? ''"
                  @update:model-value="(v) => selectedIndex != null && updateField(selectedIndex, 'label', String(v ?? ''))"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label>Тип поля</Label>
                <Select
                  v-if="selectedIndex !== null"
                  :model-value="selectedField?.mode ?? 'static'"
                  @update:model-value="(v) => selectedIndex != null && onModeChange((v ?? 'static') as FilterFieldItemSchema['mode'])"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="static">Статический список</SelectItem>
                    <SelectItem value="vocab">Словарь</SelectItem>
                    <SelectItem value="date">Только дата</SelectItem>
                    <SelectItem value="time">Только время</SelectItem>
                    <SelectItem value="datetime">Дата и время</SelectItem>
                    <SelectItem value="boolean">Булево</SelectItem>
                    <SelectItem value="string">Текст</SelectItem>
                    <SelectItem value="number">Число</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="space-y-2">
                <Label>Значение по умолчанию</Label>
                <div class="flex flex-wrap gap-2 items-center">
                  <Input
                    v-if="selectedIndex !== null"
                    :model-value="selectedField?.defaultValue ?? (isDateLikeMode(selectedField?.mode ?? '') ? '+0d' : '*')"
                    :type="selectedField?.mode === 'number' ? 'number' : 'text'"
                    :placeholder="selectedField?.mode === 'number' ? '0' : (isDateLikeMode(selectedField?.mode ?? '') ? '+0d' : undefined)"
                    class="flex-1 min-w-[120px]"
                    @update:model-value="(v) => selectedIndex != null && updateField(selectedIndex, 'defaultValue', String(v ?? '*'))"
                  />
                  <Button
                    v-if="selectedIndex !== null && isDateLikeMode(selectedField?.mode ?? '')"
                    type="button"
                    variant="outline"
                    size="sm"
                    class="shrink-0"
                    title="Текущая дата (+0d)"
                    @click="setDefaultToToday"
                  >
                    <Clock class="size-4 mr-1" />
                    +0d
                  </Button>
                  <Button
                    v-if="selectedIndex !== null && isDateLikeMode(selectedField?.mode ?? '')"
                    type="button"
                    variant="outline"
                    size="sm"
                    class="shrink-0"
                    title="Минус 7 дней"
                    @click="setDefaultToRelative(-7)"
                  >
                    (-7d)
                  </Button>
                  <Button
                    v-if="selectedIndex !== null && isDateLikeMode(selectedField?.mode ?? '')"
                    type="button"
                    variant="outline"
                    size="sm"
                    class="shrink-0"
                    title="Плюс 7 дней"
                    @click="setDefaultToRelative(7)"
                  >
                    (+7d)
                  </Button>
                </div>
                <p
                  v-if="selectedIndex !== null && isDateLikeMode(selectedField?.mode ?? '')"
                  class="text-xs text-muted-foreground"
                >
                  Для дат: +0d (сегодня), ±Nd (дни), ±Nw (недели), ±Nm (месяцы), ±Ny (годы). Пример: -7d, +2w, +1m.
                </p>
              </div>
            </div>

            <div v-if="selectedField?.mode === 'static'" class="space-y-4 border-t pt-4">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium text-muted-foreground">Допустимые значения</span>
                <Button variant="outline" size="sm" class="h-7" @click="addStaticOption">
                  <Plus class="size-3.5 mr-1" />
                  Добавить вариант
                </Button>
              </div>
              <div class="space-y-2">
                <div
                  v-for="(opt, optIndex) in selectedStaticOptions"
                  :key="optIndex"
                  class="flex items-center gap-2 rounded-md border p-2"
                >
                  <Input
                    :model-value="opt.value"
                    placeholder="Значение"
                    class="flex-1 min-w-0 font-mono text-xs"
                    @update:model-value="(v) => updateStaticOption(optIndex, 'value', String(v ?? ''))"
                  />
                  <Input
                    :model-value="opt.label ?? ''"
                    placeholder="Подпись (необяз.)"
                    class="flex-1 min-w-0 text-xs"
                    @update:model-value="(v) => updateStaticOption(optIndex, 'label', String(v ?? ''))"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Удалить вариант"
                    @click="removeStaticOption(optIndex)"
                  >
                    <Trash2 class="size-4" />
                  </Button>
                </div>
                <p v-if="selectedStaticOptions.length === 0" class="text-xs text-muted-foreground">
                  Нет вариантов. Нажмите «Добавить вариант».
                </p>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox
                  v-if="selectedIndex !== null"
                  :model-value="selectedField?.multiple !== false"
                  @update:model-value="(v) => selectedIndex != null && updateField(selectedIndex, 'multiple', v === true)"
                />
                <Label>Разрешить множественный ввод</Label>
              </div>
            </div>

            <div v-if="selectedField?.mode === 'vocab'" class="space-y-4 border-t pt-4">
              <div class="text-sm font-medium text-muted-foreground">Словарь</div>
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label>Набор словарей</Label>
                  <Select
                    v-if="selectedIndex !== null"
                    :key="`vocab-identity-${selectedIndex}-${selectedField?.vocabIdentity ?? ''}`"
                    :model-value="selectedField?.vocabIdentity ?? ''"
                    @update:model-value="(v) => selectedIndex != null && onVocabIdentityChange(selectedIndex, String(v ?? ''))"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите набор" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="opt in vocabIdentityOptions"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="space-y-2">
                  <Label>Словарь</Label>
                  <Select
                    v-if="selectedIndex !== null"
                    :key="`vocab-collection-${selectedIndex}-${selectedField?.vocabIdentity}-${selectedField?.vocabCollection ?? ''}`"
                    :model-value="selectedField?.vocabCollection ?? ''"
                    @update:model-value="(v) => selectedIndex != null && updateField(selectedIndex, 'vocabCollection', String(v ?? ''))"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите словарь" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="opt in getVocabCollectionOptions(selectedField?.vocabIdentity)"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label>Путь до поля значения (valuePath)</Label>
                  <Input
                    v-if="selectedIndex !== null"
                    :model-value="selectedField?.valuePath ?? ''"
                    placeholder="например: code"
                    @update:model-value="(v) => selectedIndex != null && updateField(selectedIndex, 'valuePath', String(v ?? ''))"
                  />
                </div>
                <div class="space-y-2">
                  <Label>Путь до поля подписи (displayNamePath)</Label>
                  <Input
                    v-if="selectedIndex !== null"
                    :model-value="selectedField?.displayNamePath ?? ''"
                    placeholder="например: name"
                    @update:model-value="(v) => selectedIndex != null && updateField(selectedIndex, 'displayNamePath', String(v ?? ''))"
                  />
                </div>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox
                  v-if="selectedIndex !== null"
                  :model-value="selectedField?.multiple !== false"
                  @update:model-value="(v) => selectedIndex != null && updateField(selectedIndex, 'multiple', v === true)"
                />
                <Label>Разрешить множественный ввод</Label>
              </div>
            </div>

            <!-- Цепочка конвертеров (в конце, перед Активно) -->
            <div class="space-y-2 border-t pt-4">
              <Label>Конвертеры (по порядку)</Label>
              <div class="flex flex-wrap items-center gap-2">
                <template v-for="(id, i) in selectedConverterIds" :key="`${id}-${i}`">
                  <span class="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                    {{ converterOptions.find(o => o.value === id)?.label ?? id }}
                    <button
                      type="button"
                      class="rounded hover:bg-muted-foreground/20 p-0.5"
                      aria-label="Удалить"
                      @click="removeConverterFromField(i)"
                    >
                      <Trash2 class="size-3.5" />
                    </button>
                  </span>
                </template>
                <DomainEntityDropTarget
                  v-if="selectedIndex !== null"
                  :accept-section-types="[DomainSectionType.Converter]"
                  :show-hint="false"
                  @update:model-value="(v) => addConverterToField(v)"
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button size="icon" variant="outline" class="size-8 shrink-0" aria-label="Добавить конвертер">
                        <Plus class="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        v-for="opt in converterOptions"
                        :key="opt.value"
                        @select="addConverterToField(opt.value)"
                      >
                        {{ opt.label }}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </DomainEntityDropTarget>
              </div>
            </div>

            <div class="flex items-center justify-between pt-2">
              <div class="flex items-center gap-2">
                <Checkbox
                  v-if="selectedIndex !== null"
                  :model-value="activeChecked"
                  @update:model-value="activeChecked = $event"
                />
                <Label>Активно</Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                class="text-destructive shrink-0"
                @click="selectedIndex != null && removeField(selectedIndex)"
              >
                <Trash2 class="size-4 mr-1" />
                Удалить
              </Button>
            </div>
          </div>
        </ScrollArea>
      </Card>

      <Card class="p-4">
        <PresentationBindingEditor
          :editor-model="editor"
          owner-type="filter"
          :owner-id="typeof editor?.id === 'number' ? editor.id : Number(editor?.id ?? '') || null"
          target-type="filter"
          :target-id="typeof editor?.id === 'number' ? editor.id : Number(editor?.id ?? '') || null"
        />
      </Card>
    </div>
  </div>
</template>
