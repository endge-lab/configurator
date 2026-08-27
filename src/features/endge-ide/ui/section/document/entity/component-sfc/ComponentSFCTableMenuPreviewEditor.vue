<script setup lang="ts">
import type {
  ComponentSFCExpressionCompletionScope,
  ComponentSFCTableMenuActionOption,
  ComponentSFCTableMenuNodeProjection,
  ComponentSFCTableMenuProjection,
  ComponentSFCTableVisualMenuKind,
  ComponentSFCVisualSourceValue,
} from '@endge/core'
import type { SearchableSelectOption } from '@/components/ui/searchable-select'

import { readComponentSFCTranslationFallback } from '@endge/core'
import {
  Braces,
  Check,
  Code2,
  ExternalLink,
  GripVertical,
  Languages,
  Minus,
  Pencil,
  Plus,
  SquareMenu,
  Trash2,
  X,
  Zap,
} from 'lucide-vue-next'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import ComponentSFCExpressionInput from '@/features/endge-ide/ui/section/document/entity/component-sfc/ComponentSFCExpressionInput.vue'

interface MenuItemDraft {
  labelMode: 'text' | 'translation'
  label: string
  translationKey: string
  action: string
  input: string
  icon: string
  visible: string
  disabled: string
}

interface MenuLabelUpdate {
  index: number
  mode: 'text' | 'translation'
  label: string
  translationKey: string
}

const props = defineProps<{
  kind: ComponentSFCTableVisualMenuKind
  menu: ComponentSFCTableMenuProjection
  actions: ComponentSFCTableMenuActionOption[]
  allowInherit?: boolean
}>()

const emit = defineEmits<{
  (event: 'setMode', value: 'default' | 'disabled' | 'none' | 'custom'): void
  (event: 'createItem', draft: MenuItemDraft): void
  (event: 'addSeparator'): void
  (event: 'moveItem', payload: { fromIndex: number, toIndex: number }): void
  (event: 'removeItem', index: number): void
  (event: 'saveLabel', payload: MenuLabelUpdate, complete?: (saved: boolean) => void): void
  (event: 'setAction', payload: { index: number, value: string | null }): void
  (event: 'saveDetails', payload: { index: number, input: string, icon: string, visible: string, disabled: string }, complete?: (saved: boolean) => void): void
  (event: 'openSource', item?: ComponentSFCTableMenuNodeProjection): void
}>()

const root = ref<HTMLElement | null>(null)
const selectedIndex = ref<number | null>(null)
const editingIndex = ref<number | null>(null)
const actionInspectorIndex = ref<number | null>(null)
const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
const labelDraft = ref('')
const translationKeyDraft = ref('')
const translationDraft = ref(false)
const inputDraft = ref('')
const iconDraft = ref('')
const visibleDraft = ref('')
const disabledDraft = ref('')
const creatingItem = ref(false)
const newItemDraft = reactive<MenuItemDraft>({
  labelMode: 'text',
  label: 'Новый пункт',
  translationKey: 'table:menu.new-item',
  action: '',
  input: '',
  icon: '',
  visible: '',
  disabled: '',
})

const menuIsCustom = computed(() => props.menu.mode === 'custom')
const expressionScope = computed<ComponentSFCExpressionCompletionScope>(() => props.kind === 'row'
  ? 'table-row-menu'
  : 'table-column-menu')
const inspectedItem = computed(() => {
  if (actionInspectorIndex.value == null) {
    return null
  }
  const item = props.menu.items[actionInspectorIndex.value]
  return item?.kind === 'item' ? item : null
})
const actionOptions = computed<SearchableSelectOption[]>(() => props.actions.map(action => ({
  value: action.identity,
  label: action.identity,
  group: actionSourceLabel(action.source),
})))
const canCreateItem = computed(() => Boolean(newItemDraft.label.trim() && newItemDraft.action.trim()))

watch(
  () => props.menu,
  () => {
    if (props.menu.mode !== 'custom') {
      creatingItem.value = false
      selectedIndex.value = null
      closeActionInspector()
    }
    if (editingIndex.value != null) {
      editingIndex.value = null
      toast.info('Меню обновлено', {
        description: 'Незавершённое inline-редактирование отменено.',
      })
    }
    if (selectedIndex.value != null && selectedIndex.value >= props.menu.items.length) {
      selectedIndex.value = props.menu.items.length ? props.menu.items.length - 1 : null
    }
    if (actionInspectorIndex.value != null) {
      if (!inspectedItem.value) {
        closeActionInspector()
      }
      else {
        syncInspectorDrafts(inspectedItem.value)
      }
    }
  },
)

function sourceValueText(value: ComponentSFCVisualSourceValue | null | undefined): string {
  if (!value) {
    return ''
  }
  if (value.kind === 'expression') {
    return value.source
  }
  if (value.kind === 'boolean') {
    return value.value ? 'true' : 'false'
  }
  return value.value == null ? '' : String(value.value)
}

function itemIsSourceOwned(item: ComponentSFCTableMenuNodeProjection): boolean {
  return item.kind === 'item' && (
    item.sourceOwned
    || (item.label?.kind === 'expression' && readComponentSFCTranslationFallback(item.label.source) == null)
  )
}

function itemLabel(item: ComponentSFCTableMenuNodeProjection): string {
  if (item.kind !== 'item') {
    return ''
  }
  if (item.label?.kind === 'expression') {
    return readComponentSFCTranslationFallback(item.label.source) ?? item.label.source
  }
  return sourceValueText(item.label) || 'Без названия'
}

function itemTranslationKey(item: ComponentSFCTableMenuNodeProjection): string {
  if (item.kind !== 'item' || item.label?.kind !== 'expression') {
    return `table:menu.${item.id}`
  }
  return item.label.source.match(/^\s*t\(\s*(['"])(.*?)\1/)?.[2] ?? `table:menu.${item.id}`
}

function itemAction(item: ComponentSFCTableMenuNodeProjection): string {
  return item.kind === 'item' ? sourceValueText(item.action) : ''
}

function itemIcon(item: ComponentSFCTableMenuNodeProjection): string {
  return item.kind === 'item' ? sourceValueText(item.icon) : ''
}

function actionSourceLabel(source: ComponentSFCTableMenuActionOption['source']): string {
  switch (source) {
    case 'intrinsic': return 'Intrinsic'
    case 'built-in': return 'Built-in'
    case 'external': return 'External'
    case 'required': return 'Required port'
    case 'provided': return 'Provided port'
    case 'forwarded': return 'Forwarded port'
  }
}

function beginLabelEdit(index: number, item: ComponentSFCTableMenuNodeProjection): void {
  if (item.kind !== 'item') {
    return
  }
  if (itemIsSourceOwned(item) || props.menu.sourceOwned) {
    emit('openSource', item)
    return
  }
  creatingItem.value = false
  closeActionInspector()
  selectedIndex.value = index
  editingIndex.value = index
  translationDraft.value = item.label?.kind === 'expression'
  labelDraft.value = itemLabel(item)
  translationKeyDraft.value = itemTranslationKey(item)
  void nextTick(() => root.value?.querySelector<HTMLInputElement>(`[data-menu-label="${index}"]`)?.focus())
}

function saveLabelEdit(): boolean {
  const index = editingIndex.value
  if (index == null || !labelDraft.value.trim()) {
    return false
  }
  let saved = true
  emit('saveLabel', {
    index,
    mode: translationDraft.value ? 'translation' : 'text',
    label: labelDraft.value.trim(),
    translationKey: translationKeyDraft.value.trim(),
  }, result => saved = result)
  if (saved) {
    editingIndex.value = null
  }
  return saved
}

function cancelLabelEdit(): void {
  editingIndex.value = null
}

function toggleTranslationDraft(item: ComponentSFCTableMenuNodeProjection): void {
  translationDraft.value = !translationDraft.value
  if (translationDraft.value && !translationKeyDraft.value.trim()) {
    translationKeyDraft.value = itemTranslationKey(item)
  }
}

function selectItem(index: number, item: ComponentSFCTableMenuNodeProjection): void {
  selectedIndex.value = index
  if (actionInspectorIndex.value == null) {
    return
  }
  if (item.kind !== 'item' || itemIsSourceOwned(item) || props.menu.sourceOwned) {
    closeActionInspector()
    return
  }
  actionInspectorIndex.value = index
  syncInspectorDrafts(item)
}

function openActionInspector(index: number, item: ComponentSFCTableMenuNodeProjection): void {
  if (item.kind !== 'item') {
    return
  }
  if (itemIsSourceOwned(item) || props.menu.sourceOwned) {
    emit('openSource', item)
    return
  }
  editingIndex.value = null
  creatingItem.value = false
  selectedIndex.value = index
  actionInspectorIndex.value = index
  syncInspectorDrafts(item)
}

function closeActionInspector(): void {
  actionInspectorIndex.value = null
  inputDraft.value = ''
  iconDraft.value = ''
  visibleDraft.value = ''
  disabledDraft.value = ''
}

function syncInspectorDrafts(item: ComponentSFCTableMenuNodeProjection): void {
  if (item.kind !== 'item') {
    return
  }
  inputDraft.value = sourceValueText(item.input)
  iconDraft.value = sourceValueText(item.icon)
  visibleDraft.value = sourceValueText(item.visible)
  disabledDraft.value = sourceValueText(item.disabled)
}

function saveActionDetails(): boolean {
  if (actionInspectorIndex.value == null) {
    return true
  }
  let saved = true
  emit('saveDetails', {
    index: actionInspectorIndex.value,
    input: inputDraft.value,
    icon: iconDraft.value,
    visible: visibleDraft.value,
    disabled: disabledDraft.value,
  }, result => saved = result)
  if (saved) {
    closeActionInspector()
  }
  return saved
}

/** Применяет редактирование существующего пункта, но не создаёт новый пункт автоматически. */
function flushPendingEdits(): boolean {
  if (editingIndex.value != null && !saveLabelEdit()) {
    return false
  }
  return saveActionDetails()
}

defineExpose({ flushPendingEdits })

function startCreateItem(): void {
  closeActionInspector()
  editingIndex.value = null
  creatingItem.value = true
  Object.assign(newItemDraft, {
    labelMode: 'text',
    label: 'Новый пункт',
    translationKey: 'table:menu.new-item',
    action: '',
    input: '',
    icon: '',
    visible: '',
    disabled: '',
  } satisfies MenuItemDraft)
  void nextTick(() => root.value?.querySelector<HTMLInputElement>('[data-menu-new-label]')?.select())
}

function createItem(): void {
  if (!canCreateItem.value) {
    return
  }
  emit('createItem', { ...newItemDraft })
  creatingItem.value = false
}

function removeItem(index: number): void {
  selectedIndex.value = null
  closeActionInspector()
  emit('removeItem', index)
}

function startDrag(index: number, event: DragEvent): void {
  dragIndex.value = index
  dragOverIndex.value = index
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function dropItem(toIndex: number): void {
  const fromIndex = dragIndex.value
  resetDrag()
  if (fromIndex == null || fromIndex === toIndex) {
    return
  }
  selectedIndex.value = toIndex
  closeActionInspector()
  emit('moveItem', { fromIndex, toIndex })
}

function resetDrag(): void {
  dragIndex.value = null
  dragOverIndex.value = null
}
</script>

<template>
  <article ref="root" class="relative overflow-hidden rounded-xl border border-sky-500/25 bg-background shadow-sm">
    <div v-if="!menu.sourceOwned" class="absolute right-3 top-3 z-20">
      <Select
        :model-value="menu.mode"
        @update:model-value="value => emit('setMode', String(value ?? '') as 'default' | 'disabled' | 'none' | 'custom')"
      >
        <SelectTrigger class="editor-control h-7 w-28 bg-background/90 text-[11px] shadow-sm backdrop-blur">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <template v-if="kind === 'column'">
            <SelectItem value="default">
              {{ $t('uiText.default808d7dca') }}
            </SelectItem>
            <SelectItem value="custom">
              {{ $t('uiText.custom081ae3fd') }}
            </SelectItem>
            <SelectItem value="disabled">
              {{ $t('uiText.disabledf4f4473d') }}
            </SelectItem>
          </template>
          <template v-else>
            <SelectItem v-if="allowInherit" value="default">
              {{ $t('uiText.inherit18f99833') }}
            </SelectItem>
            <SelectItem value="none">
              {{ $t('uiText.none6eef6648') }}
            </SelectItem>
            <SelectItem value="custom">
              {{ $t('uiText.custom081ae3fd') }}
            </SelectItem>
          </template>
          <SelectItem v-if="menu.mode === 'source'" value="source">
            {{ $t('uiText.sourceda13add2') }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div v-if="menu.sourceOwned" class="flex items-center justify-between gap-3 border-b border-dashed border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      <span class="flex items-center gap-2"><Code2 class="size-3.5" /> {{ $t('uiText.theMenuContainsSourceOwnedConstructsAndIsReadOnly5bc1d2c9') }}</span>
      <Button variant="outline" size="sm" class="h-7 shrink-0 gap-1" @click="emit('openSource')">
        {{ $t('uiText.sourceda13add2') }} <ExternalLink class="size-3" />
      </Button>
    </div>

    <div
      v-if="menuIsCustom"
      class="grid min-h-[20rem] min-w-0 transition-[grid-template-columns] xl:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div class="flex min-w-0 items-start justify-center overflow-x-auto bg-muted/10 px-16 py-8 shadow-inner">
        <TooltipProvider :delay-duration="120">
          <div class="w-full max-w-sm rounded-lg border border-border/80 bg-popover py-1 text-popover-foreground shadow-xl shadow-black/10">
            <div v-if="!menu.items.length && !creatingItem" class="px-4 py-8 text-center">
              <SquareMenu class="mx-auto size-7 text-muted-foreground/60" />
              <p class="mt-2 text-xs font-medium">
                {{ $t('uiText.theMenuIsEmpty9a88ce21') }}
              </p>
              <p class="mt-1 text-[11px] text-muted-foreground">
                {{ $t('uiText.addTheFirstItemOrSeparator1bf8ec0c') }}
              </p>
            </div>

            <template v-for="(item, itemIndex) in menu.items" :key="`${item.id}-${itemIndex}`">
              <div
                v-if="item.kind === 'separator'"
                class="group relative px-3 py-2"
                :class="dragOverIndex === itemIndex && dragIndex !== itemIndex ? 'bg-sky-500/10' : ''"
                @dragover.prevent="dragOverIndex = itemIndex"
                @drop.prevent="dropItem(itemIndex)"
              >
                <div class="h-px bg-border" />
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button
                      type="button"
                      draggable="true"
                      class="absolute -left-9 top-1/2 flex size-7 -translate-y-1/2 cursor-grab items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent active:cursor-grabbing group-hover:opacity-100"
                      aria-label="Перетащить разделитель"
                      @dragstart.stop="startDrag(itemIndex, $event)"
                      @dragend="resetDrag"
                    >
                      <GripVertical class="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{{ $t('uiText.drag710b4d61') }}</TooltipContent>
                </Tooltip>
                <Button
                  v-if="!menu.sourceOwned"
                  variant="ghost"
                  size="icon"
                  class="absolute -right-9 top-1/2 size-7 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  aria-label="Удалить разделитель"
                  @click="removeItem(itemIndex)"
                >
                  <Trash2 class="size-3.5" />
                </Button>
              </div>

              <div
                v-else
                class="group relative"
                :class="dragOverIndex === itemIndex && dragIndex !== itemIndex ? 'bg-sky-500/10' : ''"
                @dragover.prevent="dragOverIndex = itemIndex"
                @drop.prevent="dropItem(itemIndex)"
              >
                <div
                  v-if="editingIndex === itemIndex"
                  class="border-y border-sky-500/30 bg-sky-500/[0.06] p-2"
                >
                  <div class="flex items-center gap-1.5">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          class="size-7 shrink-0"
                          :class="translationDraft ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300' : 'text-muted-foreground'"
                          aria-label="Переключить режим перевода"
                          @click="toggleTranslationDraft(item)"
                        >
                          <Languages class="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{{ translationDraft ? $t('uiText.translationUsed40a2be4b') : $t('uiText.plainTexta08705ee') }}</TooltipContent>
                    </Tooltip>
                    <Input
                      v-model="labelDraft"
                      :data-menu-label="itemIndex"
                      class="editor-control h-8 min-w-0 flex-1"
                      :placeholder="translationDraft ? 'Fallback' : 'Название пункта'"
                      @keydown.enter.prevent="saveLabelEdit"
                      @keydown.esc.prevent="cancelLabelEdit"
                    />
                    <Button variant="ghost" size="icon" class="size-7 text-emerald-600" :disabled="!labelDraft.trim()" aria-label="Применить название" @click="saveLabelEdit">
                      <Check class="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" class="size-7 text-muted-foreground" aria-label="Отменить редактирование" @click="cancelLabelEdit">
                      <X class="size-3.5" />
                    </Button>
                  </div>
                  <Input
                    v-if="translationDraft"
                    v-model="translationKeyDraft"
                    class="editor-control mt-2 h-8 font-mono text-xs"
                    placeholder="bundle:menu.key"
                    @keydown.enter.prevent="saveLabelEdit"
                    @keydown.esc.prevent="cancelLabelEdit"
                  />
                </div>

                <button
                  v-else
                  type="button"
                  class="flex min-h-9 w-full items-center gap-2 px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                  :class="selectedIndex === itemIndex ? 'bg-accent text-accent-foreground' : ''"
                  @click="selectItem(itemIndex, item)"
                  @dblclick="beginLabelEdit(itemIndex, item)"
                  @keydown.enter.prevent="beginLabelEdit(itemIndex, item)"
                  @keydown.f2.prevent="beginLabelEdit(itemIndex, item)"
                >
                  <SquareMenu v-if="itemIcon(item)" class="size-3.5 shrink-0 text-muted-foreground" />
                  <span class="min-w-0 flex-1 truncate">{{ itemLabel(item) }}</span>
                  <Code2 v-if="itemIsSourceOwned(item)" class="size-3.5 shrink-0 text-muted-foreground" />
                  <Pencil v-else class="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-70" />
                </button>

                <Tooltip>
                  <TooltipTrigger as-child>
                    <button
                      v-if="!menu.sourceOwned"
                      type="button"
                      draggable="true"
                      class="absolute -left-9 top-1/2 flex size-7 -translate-y-1/2 cursor-grab items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent active:cursor-grabbing group-hover:opacity-100"
                      aria-label="Перетащить пункт"
                      @dragstart.stop="startDrag(itemIndex, $event)"
                      @dragend="resetDrag"
                    >
                      <GripVertical class="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{{ $t('uiText.drag710b4d61') }}</TooltipContent>
                </Tooltip>

                <div class="absolute -right-[4.5rem] top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100" :class="selectedIndex === itemIndex ? 'opacity-100' : ''">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="size-7"
                        :class="itemAction(item) ? 'text-sky-600 dark:text-sky-300' : 'text-amber-600'"
                        :aria-label="itemIsSourceOwned(item) ? 'Открыть Source' : 'Настроить Action'"
                        @click="openActionInspector(itemIndex, item)"
                      >
                        <Code2 v-if="itemIsSourceOwned(item)" class="size-3.5" />
                        <Zap v-else class="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{{ itemIsSourceOwned(item) ? $t('uiText.openSource4dda88e1') : (itemAction(item) || 'Action не назначен') }}</TooltipContent>
                  </Tooltip>
                  <Button
                    v-if="!itemIsSourceOwned(item) && !menu.sourceOwned"
                    variant="ghost"
                    size="icon"
                    class="size-7 text-muted-foreground hover:text-destructive"
                    aria-label="Удалить пункт"
                    @click="removeItem(itemIndex)"
                  >
                    <Trash2 class="size-3.5" />
                  </Button>
                </div>
              </div>
            </template>

            <div v-if="creatingItem" class="border-t border-sky-500/25 bg-sky-500/[0.05] p-3">
              <div class="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-7 shrink-0"
                  :class="newItemDraft.labelMode === 'translation' ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300' : 'text-muted-foreground'"
                  aria-label="Переключить режим перевода"
                  @click="newItemDraft.labelMode = newItemDraft.labelMode === 'translation' ? 'text' : 'translation'"
                >
                  <Languages class="size-3.5" />
                </Button>
                <Input
                  v-model="newItemDraft.label"
                  data-menu-new-label
                  class="editor-control h-8 min-w-0 flex-1"
                  :placeholder="newItemDraft.labelMode === 'translation' ? 'Fallback' : 'Название пункта'"
                  @keydown.esc.prevent="creatingItem = false"
                />
              </div>
              <Input
                v-if="newItemDraft.labelMode === 'translation'"
                v-model="newItemDraft.translationKey"
                class="editor-control mt-2 h-8 font-mono text-xs"
                placeholder="bundle:menu.key"
              />
              <SearchableSelect
                v-model="newItemDraft.action"
                :options="actionOptions"
                placeholder="Выберите обязательный Action…"
                size="compact"
                trigger-class="editor-control mt-2 h-8 font-mono text-xs"
              />
              <div class="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
                <Input v-model="newItemDraft.input" class="editor-control h-8 font-mono text-xs" placeholder="Input expression" />
                <Input v-model="newItemDraft.icon" class="editor-control h-8 font-mono text-xs" placeholder="Icon" />
              </div>
              <div class="mt-2 grid gap-2 sm:grid-cols-2">
                <ComponentSFCExpressionInput
                  v-model="newItemDraft.visible"
                  :scope="expressionScope"
                  input-class="editor-control h-8 font-mono text-xs"
                  placeholder="Показывать, когда"
                />
                <ComponentSFCExpressionInput
                  v-model="newItemDraft.disabled"
                  :scope="expressionScope"
                  input-class="editor-control h-8 font-mono text-xs"
                  placeholder="Отключать, когда"
                />
              </div>
              <div class="mt-3 flex justify-end gap-2">
                <Button variant="ghost" size="sm" class="h-7" @click="creatingItem = false">
                  {{ $t('uiText.cancel0ec753be') }}
                </Button>
                <Button size="sm" class="h-7 gap-1" :disabled="!canCreateItem" @click="createItem">
                  <Check class="size-3" /> {{ $t('uiText.add559a87f7') }}
                </Button>
              </div>
            </div>

            <div v-else-if="!menu.sourceOwned" class="flex border-t border-border/70 p-1">
              <Button variant="ghost" size="sm" class="h-8 flex-1 justify-start gap-1.5 text-xs text-muted-foreground" @click="startCreateItem">
                <Plus class="size-3.5" /> {{ $t('uiText.addItem6d8cf1ac') }}
              </Button>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button variant="ghost" size="icon" class="size-8 text-muted-foreground" aria-label="Добавить разделитель" @click="emit('addSeparator')">
                    <Minus class="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{{ $t('uiText.addSeparatorfffa4fdb') }}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </div>

      <aside v-if="inspectedItem && actionInspectorIndex != null" class="w-[22rem] max-w-[42vw] border-l border-border/70 bg-background p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <Zap class="size-4 text-sky-600 dark:text-sky-300" />
              <h4 class="truncate text-sm font-semibold">
                {{ $t('uiText.action97c89a4d') }}
              </h4>
            </div>
            <p class="mt-1 truncate text-[11px] text-muted-foreground">
              {{ itemLabel(inspectedItem) }}
            </p>
          </div>
          <Button variant="ghost" size="icon" class="size-7" aria-label="Закрыть настройки Action" @click="closeActionInspector">
            <X class="size-3.5" />
          </Button>
        </div>

        <div class="mt-4 space-y-4">
          <div class="space-y-1.5">
            <Label class="text-[11px]">{{ $t('uiText.showWhen348f6be8') }}</Label>
            <ComponentSFCExpressionInput
              v-model="visibleDraft"
              :scope="expressionScope"
              input-class="editor-control h-8 font-mono text-xs"
              placeholder="$row.data.status === 'active'"
            />
          </div>

          <div class="space-y-1.5">
            <Label class="text-[11px]">{{ $t('uiText.disableWhenbd90695b') }}</Label>
            <ComponentSFCExpressionInput
              v-model="disabledDraft"
              :scope="expressionScope"
              input-class="editor-control h-8 font-mono text-xs"
              placeholder="!$row.data.canEdit"
            />
          </div>

          <div class="space-y-1.5">
            <Label class="text-[11px]">{{ $t('uiText.actionIdentitye3aba971') }}</Label>
            <SearchableSelect
              :model-value="itemAction(inspectedItem) || null"
              :options="actionOptions"
              placeholder="Action не назначен"
              size="compact"
              trigger-class="editor-control h-8 font-mono text-xs"
              @update:model-value="value => emit('setAction', { index: actionInspectorIndex!, value: value == null ? null : String(value) })"
            />
          </div>

          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <Label class="text-[11px]">{{ $t('uiText.inputMappinge48882e5') }}</Label>
              <Braces class="size-3.5 text-muted-foreground" />
            </div>
            <Input v-model="inputDraft" class="editor-control h-8 font-mono text-xs" placeholder="{ id: $row.id, value: $cell.value }" />
            <div class="flex flex-wrap gap-1">
              <code v-for="token in ['$table', '$row', '$column', '$cell', '$context', 'props']" :key="token" class="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                {{ token }}
              </code>
            </div>
          </div>

          <div class="space-y-1.5">
            <Label class="text-[11px]">{{ $t('uiText.iconIdentity2ac4b4f5') }}</Label>
            <Input v-model="iconDraft" class="editor-control h-8 font-mono text-xs" placeholder="icon identity" />
          </div>

          <div class="flex items-center justify-between gap-2 border-t pt-3">
            <Button variant="ghost" size="sm" class="h-7 gap-1 text-xs text-muted-foreground" @click="emit('openSource', inspectedItem)">
              {{ $t('uiText.sourceda13add2') }} <ExternalLink class="size-3" />
            </Button>
            <Button size="sm" class="h-7 gap-1 text-xs" @click="saveActionDetails">
              <Check class="size-3" /> {{ $t('uiText.apply768af677') }}
            </Button>
          </div>
        </div>
      </aside>
    </div>

    <div v-else class="flex min-h-48 flex-col items-center justify-center p-8 text-center">
      <SquareMenu class="size-8 text-muted-foreground/60" />
      <p class="mt-3 text-sm font-medium">
        {{ kind === 'column' && menu.mode === 'default' ? $t('uiText.standardAdapterMenuIsUsedb1ebcb28') : $t('uiText.declarativeMenuIsDisabled56eaf5d6') }}
      </p>
      <p class="mt-1 max-w-sm text-[11px] leading-relaxed text-muted-foreground">
        {{ $t('uiText.enableCustomToBuildTheMenuDirectlyInPreview41222a9d') }}
      </p>
      <Button v-if="!menu.sourceOwned" variant="outline" size="sm" class="mt-4 h-8 gap-1.5" @click="emit('setMode', 'custom')">
        <Plus class="size-3.5" /> {{ $t('uiText.createCustomMenu5c6ed567') }}
      </Button>
    </div>
  </article>
</template>
