<script setup lang="ts">
import type { RComponentTableColumnEditor } from "@/features/endge-ide/domain/entities/RComponentTableColumnEditor";
import { DomainSectionType, Endge } from "@endge/core";
import {
  Eraser,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Table2,
  Trash2,
} from "lucide-vue-next";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSmartTabSelection } from "@/components/ui/smart-tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RFieldEditor } from "@/features/endge-ide/domain/entities/RFieldEditor";
import { EndgeIDE } from "@/features/endge-ide/model/core/endge-ide.ts";
import ScriptEditor from "@/features/endge-ide/ui/components/ScriptEditor.vue";
import TableDataMappingAssistant from "@/features/endge-ide/ui/components/TableDataMappingAssistant.vue";
import DomainEntityDropTarget from "@/features/endge-ide/ui/components/DomainEntityDropTarget.vue";
import OpenEntityButton from "@/features/endge-ide/ui/components/OpenEntityButton.vue";
import TypeRegistrySelect from "@/features/endge-ide/ui/components/TypeRegistrySelect.vue";
import { registerAgentTableAction } from "@/features/endge-ide/model/agent/agent-table-actions";

const tabs = EndgeIDE.tabs;
const editor = computed<any>(() => tabs.documentEditorModel.value ?? null);
const previewModel = computed<any>(() => tabs.documentModel.value);
function normalizeRelationId(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text) return null;
  const id = Number(text);
  return Number.isFinite(id) ? id : null;
}
async function save(): Promise<void> {
  await EndgeIDE.tabs.save();
}

const componentsOptions = computed(() => {
  const list = Endge.domain.getComponents();
  return list.map((c) => ({
    value: String(c.id),
    label: c.name ?? String(c.id),
  }));
});

const selectedColumnIndex = ref<number | null>(null);
watch(
  editor,
  (e) => {
    if (!e?.columns?.length) {
      selectedColumnIndex.value = null;
      return;
    }
    const sel = e.selectedColumn;
    if (sel) {
      const idx = (e.columns as RComponentTableColumnEditor[]).indexOf(sel);
      if (idx >= 0) selectedColumnIndex.value = idx;
    }
  },
  { immediate: true },
);

const selectedColumn = computed(() => {
  const idx = selectedColumnIndex.value;
  const cols = editor.value?.columns ?? [];
  if (idx == null || idx < 0 || idx >= cols.length) return null;
  return cols[idx] as RComponentTableColumnEditor;
});

watch(
  selectedColumnIndex,
  (idx) => {
    const ed = editor.value;
    if (
      ed &&
      typeof idx === "number" &&
      idx >= 0 &&
      idx < (ed.columns?.length ?? 0)
    )
      ed.selectColumnByIndex(idx);
    else if (ed) ed.selectColumnByIndex(null);
  },
  { flush: "sync" },
);

const columns = computed(
  () => (editor.value?.columns ?? []) as RComponentTableColumnEditor[],
);

const dragColumnIndex = ref<number | null>(null);
const dragOverColumnIndex = ref<number | null>(null);

function addColumn(title = ""): void {
  editor.value?.addColumn(title);
  const len = editor.value?.columns?.length ?? 0;
  if (len) selectedColumnIndex.value = len - 1;
}

/** Очистить во всех колонках все привязки данных (dataPaths и конвертеры). */
function clearAllDataPathBindings(): void {
  const ed = editor.value;
  if (!ed?.columns?.length) return;
  for (const col of ed.columns as RComponentTableColumnEditor[]) {
    const accessors = col.accessors ?? [];
    for (const acc of accessors) {
      acc.accessor = "";
      acc.converter = "";
    }
  }
}

function removeColumn(index: number): void {
  const ed = editor.value;
  if (!ed || index < 0 || index >= ed.columns.length) return;
  const col = ed.columns[index] as RComponentTableColumnEditor;
  ed.deleteColumns([col]);
  if (selectedColumnIndex.value === index) selectedColumnIndex.value = null;
  else if (
    selectedColumnIndex.value != null &&
    selectedColumnIndex.value > index
  )
    selectedColumnIndex.value -= 1;
}

/** Удалить колонку по индексу. Возвращает false, если индекс некорректен. */
function removeColumnByIndex(index: number): boolean {
  if (!Number.isInteger(index) || index < 0) return false;
  const ed = editor.value;
  const len = ed?.columns?.length ?? 0;
  if (!len || index >= len) return false;
  removeColumn(index);
  return true;
}

const _unregAgentTable: (() => void)[] = [];
onMounted(() => {
  _unregAgentTable.push(
    registerAgentTableAction("clear_all_datapaths", () => {
      clearAllDataPathBindings();
    }),
    registerAgentTableAction("add_column", (p?: unknown) => {
      addColumn((p as { title?: string })?.title ?? "");
    }),
    registerAgentTableAction("remove_column", (p?: unknown) => {
      return removeColumnByIndex((p as { index?: number })?.index ?? -1);
    }),
  );
});
onBeforeUnmount(() => {
  _unregAgentTable.forEach((u) => u());
});

function onColumnDragStart(e: DragEvent, index: number): void {
  dragColumnIndex.value = index;
  dragOverColumnIndex.value = index;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }
}

function onColumnDragOver(e: DragEvent, index: number): void {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  dragOverColumnIndex.value = index;
}

function onColumnDragLeave(): void {
  dragOverColumnIndex.value = null;
}

function onColumnDrop(e: DragEvent, dropIndex: number): void {
  e.preventDefault();
  const from = dragColumnIndex.value;
  if (from == null) {
    dragColumnIndex.value = null;
    dragOverColumnIndex.value = null;
    return;
  }
  if (from !== dropIndex) editor.value?.moveColumn(from, dropIndex);
  if (selectedColumnIndex.value === from) selectedColumnIndex.value = dropIndex;
  else if (
    selectedColumnIndex.value != null &&
    selectedColumnIndex.value > from &&
    selectedColumnIndex.value <= dropIndex
  )
    selectedColumnIndex.value -= 1;
  else if (
    selectedColumnIndex.value != null &&
    selectedColumnIndex.value >= dropIndex &&
    selectedColumnIndex.value < from
  )
    selectedColumnIndex.value += 1;
  dragColumnIndex.value = null;
  dragOverColumnIndex.value = null;
}

function onColumnDragEnd(): void {
  dragColumnIndex.value = null;
  dragOverColumnIndex.value = null;
}

function addInputField(): void {
  editor.value?.inputFields.push(RFieldEditor.createDefault());
}

function removeInputField(idx: number): void {
  editor.value?.inputFields.splice(idx, 1);
}

function ensureKeys(): Record<string, { pk?: string; fk?: string }> {
  const e = editor.value as any;
  if (!e?.bindings) e.bindings = { keys: {} };
  else if (!e.bindings.keys) e.bindings.keys = {};
  return e.bindings.keys;
}

function getPk(name: string): string {
  return (editor.value as any)?.bindings?.keys?.[name]?.pk ?? "";
}

function setPk(name: string, val: string): void {
  if (!name) return;
  const keys = ensureKeys();
  keys[name] = { ...(keys[name] ?? {}), pk: val };
}

function getFk(name: string): string {
  return (editor.value as any)?.bindings?.keys?.[name]?.fk ?? "";
}

function setFk(name: string, val: string): void {
  if (!name) return;
  const keys = ensureKeys();
  keys[name] = { ...(keys[name] ?? {}), fk: val };
}

function addAccessor(col: RComponentTableColumnEditor): void {
  col.accessors = col.accessors ?? [];
  col.accessors.push({ name: "", accessor: "", converter: "" });
}

function removeAccessor(col: RComponentTableColumnEditor, idx: number): void {
  const acc = col.accessors[idx];
  const removedKey = (acc?.name ?? "").trim();
  if (removedKey && col.sort?.by === removedKey) col.sort = null;
  col.accessors.splice(idx, 1);
}

/** Список конвертеров домена для выбора в цепочке */
const converterOptions = computed(() => {
  const list = Endge.domain.getConverters();
  return list.map((c) => ({
    value: String(c.identity ?? c.id),
    label: c.name ?? String(c.identity ?? c.id),
  }));
});

/** Значение «Выключено» для сортировки (Select не допускает пустую строку в SelectItem) */
const SORT_BY_OFF = "__sort_off__";

/** Опции полей для сортировки: ключи dataPaths текущей колонки + «Выключено» */
const sortByFieldOptions = computed(() => {
  const col = selectedColumn.value;
  const keys = (col?.accessors ?? [])
    .map((a) => (a.name || "").trim())
    .filter(Boolean);
  return [
    { value: SORT_BY_OFF, label: "Выключено" },
    ...keys.map((k) => ({ value: k, label: k })),
  ];
});

/** Типы для сортировки (только примитивы) */
const SORT_TYPE_OPTIONS = [
  { value: "String", label: "String" },
  { value: "Number", label: "Number" },
  { value: "Boolean", label: "Boolean" },
  { value: "Date", label: "Date" },
  { value: "DateTime", label: "DateTime" },
];

function setSortBy(col: RComponentTableColumnEditor, value: string): void {
  if (value === SORT_BY_OFF || !value) {
    col.sort = null;
    return;
  }
  col.sort = col.sort
    ? { ...col.sort, by: value }
    : { by: value, type: "String" };
}

function setSortType(col: RComponentTableColumnEditor, value: string): void {
  if (!col.sort) return;
  col.sort = { ...col.sort, type: value };
}

function getAccessorConverterIds(acc: { converter?: string }): string[] {
  const raw = acc.converter ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function addConverterToAccessor(
  acc: { converter?: string },
  converterId: string,
): void {
  const ids = getAccessorConverterIds(acc);
  if (ids.includes(converterId)) return;
  acc.converter = [...ids, converterId].join(", ");
}

function removeConverterFromAccessor(
  acc: { converter?: string },
  at: number,
): void {
  const ids = getAccessorConverterIds(acc);
  ids.splice(at, 1);
  acc.converter = ids.join(", ");
}

function addEventHandler(col: RComponentTableColumnEditor): void {
  col.eventBindings = col.eventBindings ?? [];
  col.eventBindings.push({ event: "", actionId: null });
}

function removeEventHandler(
  col: RComponentTableColumnEditor,
  idx: number,
): void {
  col.eventBindings.splice(idx, 1);
}

const columnDetailTab = useSmartTabSelection(
  "component-table.column-detail-tab",
  "interface",
  ["interface", "data", "events"] as const,
);
const mainTab = useSmartTabSelection(
  "editor.active-tab",
  "columns",
  ["general", "columns", "data", "settings", "assistant"] as const,
);

/** Рефы полей «Путь (accessor)» по индексу - для перевода фокуса из инспектора */
const accessorInputRefs = ref<Record<number, HTMLInputElement | null>>({});

function setAccessorInputRef(idx: number, el: unknown): void {
  if (el == null) {
    delete accessorInputRefs.value[idx];
    return;
  }
  const input =
    (el as HTMLInputElement)?.focus !== undefined
      ? (el as HTMLInputElement)
      : (el as { $el?: HTMLInputElement })?.$el;
  accessorInputRefs.value[idx] = input ?? null;
}

/** При смене выбранной строки accessor (в т.ч. из инспектора) - переносим фокус на неё */
watch(
  () => selectedColumn.value?.selectedAccessorIndex ?? -1,
  (idx) => {
    if (idx < 0) return;
    nextTick(() => {
      const el = accessorInputRefs.value[idx];
      if (el?.focus) el.focus();
    });
  },
);
</script>

<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <div v-if="!editor" class="p-5 text-sm text-muted-foreground">
      Нет данных редактора.
    </div>
    <template v-else>
      <div class="p-3 border-b flex items-center gap-3 shrink-0">
        <div
          class="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0"
        >
          <Table2 class="size-5 text-emerald-600" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-lg font-semibold truncate">
            Таблица - {{ editor.name }}
          </div>
          <div class="text-xs text-muted-foreground truncate">
            id: {{ editor.id }} · identity: {{ editor.identity ?? "-" }}
          </div>
        </div>
        <TooltipProvider :delay-duration="120">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="outline"
                class="h-9 w-9 shrink-0"
                aria-label="Сохранить"
                :disabled="EndgeIDE.busy.value"
                @click="save"
              >
                <Loader2
                  v-if="EndgeIDE.busy.value"
                  class="size-4 animate-spin"
                />
                <Save v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Сохранить</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div class="flex-1 min-h-0 flex flex-col gap-3 p-3 overflow-hidden">
        <Tabs v-model="mainTab" class="flex-1 min-h-0 flex flex-col">
          <TabsList class="grid grid-cols-5 w-full max-w-[560px] shrink-0">
            <TabsTrigger value="general"> Основное </TabsTrigger>
            <TabsTrigger value="columns"> Колонки </TabsTrigger>
            <TabsTrigger value="data"> Данные </TabsTrigger>
            <TabsTrigger value="settings"> Таблица </TabsTrigger>
            <TabsTrigger value="assistant"> Помощь </TabsTrigger>
          </TabsList>

          <TabsContent
            value="general"
            class="flex-1 min-h-0 mt-3 data-[state=inactive]:hidden"
          >
            <Card class="h-full flex flex-col overflow-hidden">
              <ScrollArea class="flex-1">
                <div class="p-4 space-y-4 max-w-2xl">
                  <div class="space-y-2">
                    <Label>ID компонента</Label>
                    <Input :model-value="editor.id" readonly />
                  </div>
                  <div class="space-y-2">
                    <Label>Identity</Label>
                    <Input v-model="editor.identity" />
                  </div>
                  <div class="space-y-2">
                    <Label>Название компонента</Label>
                    <Input v-model="editor.name" />
                  </div>
                </div>
              </ScrollArea>
            </Card>
          </TabsContent>

          <TabsContent
            value="columns"
            class="flex-1 min-h-0 flex flex-col gap-3 mt-3 data-[state=inactive]:hidden"
          >
            <Card class="shrink-0">
              <div
                class="p-2 border-b flex items-center justify-between gap-2 flex-wrap"
              >
                <span class="text-xs font-medium">Колонки таблицы</span>
                <div class="flex items-center gap-1">
                  <TooltipProvider :delay-duration="120">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          size="icon"
                          variant="outline"
                          class="size-7"
                          @click="addColumn"
                        >
                          <Plus class="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Добавить колонку</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          size="icon"
                          variant="outline"
                          class="size-7"
                          @click="clearAllDataPathBindings"
                        >
                          <Eraser class="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent
                        >Очистить все привязки данных (dataPaths) во всех
                        колонках</TooltipContent
                      >
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <div class="p-2 flex flex-wrap gap-1">
                <button
                  v-for="(col, index) in columns"
                  :key="col.id"
                  type="button"
                  draggable="true"
                  class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs transition-colors border cursor-move"
                  :class="[
                    selectedColumnIndex === index
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-muted border-transparent',
                    dragColumnIndex === index ? 'opacity-50' : '',
                    dragOverColumnIndex === index && dragColumnIndex !== index
                      ? 'ring-1 ring-primary'
                      : '',
                  ]"
                  :title="col.title"
                  @click="selectedColumnIndex = index"
                  @dragstart="(e: DragEvent) => onColumnDragStart(e, index)"
                  @dragover="(e: DragEvent) => onColumnDragOver(e, index)"
                  @dragleave="onColumnDragLeave"
                  @drop="(e: DragEvent) => onColumnDrop(e, index)"
                  @dragend="onColumnDragEnd"
                >
                  <GripVertical class="size-3.5 shrink-0 opacity-60" />
                  {{ col.title || "Без названия" }}
                </button>
                <div
                  v-if="columns.length === 0"
                  class="px-3 py-2 text-xs text-muted-foreground"
                >
                  Нет колонок. Нажмите «+» вверху.
                </div>
              </div>
            </Card>

            <Card class="flex-1 min-h-0 flex flex-col overflow-hidden">
              <ScrollArea class="flex-1">
                <div
                  v-if="selectedColumn === null"
                  class="p-4 text-sm text-muted-foreground"
                >
                  Выберите колонку выше для настройки.
                </div>
                <div v-else class="p-4">
                  <Tabs v-model="columnDetailTab" class="w-full">
                    <TabsList class="grid grid-cols-3 w-full">
                      <TabsTrigger value="interface"> Интерфейс </TabsTrigger>
                      <TabsTrigger value="data"> Данные </TabsTrigger>
                      <TabsTrigger value="events"> События </TabsTrigger>
                    </TabsList>

                    <TabsContent value="interface" class="space-y-4 mt-4">
                      <div class="space-y-2">
                        <Label>Заголовок</Label>
                        <Input v-model="selectedColumn!.title" />
                      </div>
                      <div class="space-y-2">
                        <Label>Связный компонент</Label>
                        <DomainEntityDropTarget
                          :accept-section-types="[DomainSectionType.Component]"
                          @update:model-value="
                            (v) =>
                              (selectedColumn!.componentId =
                                normalizeRelationId(v))
                          "
                        >
                          <div class="flex items-center gap-1">
                            <div class="flex-1 min-w-0">
                              <SearchableSelect
                                trigger-class="w-full"
                                :options="componentsOptions"
                                :model-value="
                                  selectedColumn!.componentId != null
                                    ? String(selectedColumn!.componentId)
                                    : null
                                "
                                placeholder="Выберите компонент"
                                @update:model-value="
                                  (v) =>
                                    (selectedColumn!.componentId =
                                      normalizeRelationId(v))
                                "
                              />
                            </div>
                            <OpenEntityButton
                              :entity-id="selectedColumn?.componentId ?? null"
                              :section-type="DomainSectionType.Component"
                            />
                          </div>
                        </DomainEntityDropTarget>
                      </div>
                      <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                          <Label>Ширина</Label>
                          <Input
                            v-model="selectedColumn!.width"
                            type="number"
                          />
                        </div>
                        <div class="space-y-2">
                          <Label>Закрепление</Label>
                          <Select v-model="selectedColumn!.pin">
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none"> Нет </SelectItem>
                              <SelectItem value="left"> Слева </SelectItem>
                              <SelectItem value="right"> Справа </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div class="flex items-center gap-2">
                        <Checkbox
                          :model-value="
                            editor?.columns?.[selectedColumnIndex ?? -1]
                              ?.isActive !== false
                          "
                          @update:model-value="
                            (v) => {
                              const idx = selectedColumnIndex;
                              const cols = editor?.columns;
                              if (
                                cols &&
                                idx != null &&
                                idx >= 0 &&
                                idx < cols.length
                              )
                                (
                                  cols[idx] as RComponentTableColumnEditor
                                ).isActive = v === true;
                            }
                          "
                        />
                        <Label>Активна</Label>
                      </div>
                    </TabsContent>

                    <TabsContent value="data" class="space-y-4 mt-4">
                      <div class="flex items-center justify-between">
                        <Label>Привязка данных (dataPaths) и конвертеры</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          @click="addAccessor(selectedColumn!)"
                        >
                          <Plus class="size-3.5 mr-1" />Добавить
                        </Button>
                      </div>
                      <div class="rounded-lg border overflow-hidden">
                        <div
                          class="bg-muted/40 border-b grid grid-cols-[1fr_1.5fr_2fr_40px] text-xs font-medium text-muted-foreground"
                        >
                          <div class="px-3 py-2">Имя поля</div>
                          <div class="px-3 py-2">Путь (accessor)</div>
                          <div class="px-3 py-2">Конвертеры (цепочка)</div>
                          <div class="px-3 py-2" />
                        </div>
                        <div
                          v-for="(acc, accIdx) in selectedColumn!.accessors ??
                          []"
                          :key="accIdx"
                          class="grid grid-cols-[1fr_1.5fr_2fr_40px] items-center divide-y gap-2"
                        >
                          <div class="px-3 py-2">
                            <Input v-model="acc.name" placeholder="name" />
                          </div>
                          <div class="px-3 py-2">
                            <Input
                              v-model="acc.accessor"
                              :ref="
                                (el: unknown) => setAccessorInputRef(accIdx, el)
                              "
                              placeholder="$store.xxx"
                              @focus="
                                selectedColumn!.selectedAccessorIndex = accIdx
                              "
                            />
                          </div>
                          <div
                            class="px-3 py-2 flex flex-wrap items-center gap-1.5 min-w-0"
                          >
                            <template
                              v-for="(id, i) in getAccessorConverterIds(acc)"
                              :key="`${accIdx}-${id}-${i}`"
                            >
                              <span
                                class="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs shrink-0"
                              >
                                {{
                                  converterOptions.find((o) => o.value === id)
                                    ?.label ?? id
                                }}
                                <button
                                  type="button"
                                  class="rounded hover:bg-muted-foreground/20 p-0.5"
                                  aria-label="Удалить конвертер"
                                  @click="removeConverterFromAccessor(acc, i)"
                                >
                                  <Trash2 class="size-3.5" />
                                </button>
                              </span>
                            </template>
                            <DomainEntityDropTarget
                              :accept-section-types="[
                                DomainSectionType.Converter,
                              ]"
                              :show-hint="false"
                              @update:model-value="
                                (v) => addConverterToAccessor(acc, v)
                              "
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger as-child>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    class="size-8 shrink-0"
                                    aria-label="Добавить конвертер"
                                  >
                                    <Plus class="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem
                                    v-for="opt in converterOptions"
                                    :key="opt.value"
                                    @select="
                                      addConverterToAccessor(acc, opt.value)
                                    "
                                  >
                                    {{ opt.label }}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </DomainEntityDropTarget>
                          </div>
                          <div class="px-3 py-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              class="text-destructive"
                              @click="removeAccessor(selectedColumn!, accIdx)"
                            >
                              <Trash2 class="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div
                        class="flex flex-wrap items-center gap-3 pt-3 border-t"
                      >
                        <Label class="shrink-0 text-muted-foreground"
                          >Сортировка</Label
                        >
                        <Select
                          :model-value="
                            selectedColumn!.sort?.by
                              ? selectedColumn!.sort.by
                              : SORT_BY_OFF
                          "
                          @update:model-value="
                            (v: string) => setSortBy(selectedColumn!, v)
                          "
                        >
                          <SelectTrigger class="w-[180px]">
                            <SelectValue placeholder="Поле" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              v-for="opt in sortByFieldOptions"
                              :key="opt.value"
                              :value="opt.value"
                            >
                              {{ opt.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          :model-value="selectedColumn!.sort?.type ?? 'String'"
                          :disabled="!selectedColumn!.sort"
                          @update:model-value="
                            (v: string) => setSortType(selectedColumn!, v)
                          "
                        >
                          <SelectTrigger class="w-[130px]">
                            <SelectValue placeholder="Тип" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              v-for="t in SORT_TYPE_OPTIONS"
                              :key="t.value"
                              :value="t.value"
                            >
                              {{ t.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TabsContent>

                    <TabsContent value="events" class="space-y-4 mt-4">
                      <div class="flex items-center justify-between">
                        <Label>Обработчики событий</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          @click="addEventHandler(selectedColumn!)"
                        >
                          <Plus class="size-3.5 mr-1" />Добавить
                        </Button>
                      </div>
                      <div class="rounded-lg border overflow-hidden">
                        <div
                          class="bg-muted/40 border-b grid grid-cols-[1fr_1fr_40px] text-xs font-medium text-muted-foreground"
                        >
                          <div class="px-3 py-2">Событие</div>
                          <div class="px-3 py-2">ID действия</div>
                          <div class="px-3 py-2" />
                        </div>
                        <div
                          v-for="(ev, evIdx) in selectedColumn!.eventBindings ??
                          []"
                          :key="evIdx"
                          class="grid grid-cols-[1fr_1fr_40px] items-center divide-y"
                        >
                          <div class="px-3 py-2">
                            <Input v-model="ev.event" placeholder="event" />
                          </div>
                          <div class="px-3 py-2">
                            <DomainEntityDropTarget
                              :accept-section-types="[DomainSectionType.Action]"
                              :show-hint="false"
                              @update:model-value="
                                (v) => (ev.actionId = v ?? null)
                              "
                            >
                              <Input
                                :model-value="
                                  ev.actionId != null ? String(ev.actionId) : ''
                                "
                                placeholder="actionId"
                                @update:model-value="
                                  (v) =>
                                    (ev.actionId = v ? Number(v) || v : null)
                                "
                              />
                            </DomainEntityDropTarget>
                          </div>
                          <div class="px-3 py-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              class="text-destructive"
                              @click="
                                removeEventHandler(selectedColumn!, evIdx)
                              "
                            >
                              <Trash2 class="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div class="mt-4 pt-4 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      class="text-destructive"
                      @click="
                        selectedColumn && removeColumn(selectedColumnIndex!)
                      "
                    >
                      <Trash2 class="size-4 mr-1" />Удалить колонку
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </Card>
          </TabsContent>

          <TabsContent
            value="data"
            class="flex-1 min-h-0 mt-3 data-[state=inactive]:hidden"
          >
            <Card class="h-full flex flex-col overflow-hidden">
              <ScrollArea class="flex-1">
                <div class="p-4 space-y-4">
                  <div class="space-y-2">
                    <Label>Source index</Label>
                    <Input v-model="editor.sourceIndex" placeholder="rows" />
                  </div>
                  <div class="space-y-2">
                    <Label>Входные переменные и привязки (PK/FK)</Label>
                    <div class="rounded-lg border overflow-hidden">
                      <div
                        class="bg-muted/40 border-b grid grid-cols-[1.2fr_1fr_120px_1fr_1fr_56px] text-xs font-medium text-muted-foreground"
                      >
                        <div class="px-3 py-2">Имя</div>
                        <div class="px-3 py-2">Тип</div>
                        <div class="px-3 py-2">Массив?</div>
                        <div class="px-3 py-2">PK</div>
                        <div class="px-3 py-2">FK</div>
                        <div class="px-3 py-2" />
                      </div>
                      <div
                        v-for="(row, idx) in editor.inputFields"
                        :key="idx"
                        class="grid grid-cols-[1.2fr_1fr_120px_1fr_1fr_56px] items-center divide-y"
                      >
                        <div class="px-3 py-2">
                          <Input v-model="row.name" />
                        </div>
                        <div class="px-3 py-2">
                          <TypeRegistrySelect
                            :model-value="row.type ?? ''"
                            placeholder="Тип"
                            size="compact"
                            @update:model-value="(v) => (row.type = v ?? '')"
                          />
                        </div>
                        <div class="px-3 py-2 flex justify-center">
                          <Checkbox
                            :model-value="!!row.isArray"
                            @update:model-value="(v) => (row.isArray = !!v)"
                          />
                        </div>
                        <div class="px-3 py-2">
                          <Input
                            :model-value="getPk(row.name)"
                            @update:model-value="
                              (v) => setPk(row.name, String(v ?? ''))
                            "
                          />
                        </div>
                        <div class="px-3 py-2">
                          <Input
                            :model-value="getFk(row.name)"
                            @update:model-value="
                              (v) => setFk(row.name, String(v ?? ''))
                            "
                          />
                        </div>
                        <div class="px-3 py-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            class="text-destructive"
                            @click="removeInputField(idx)"
                          >
                            <Trash2 class="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" @click="addInputField">
                      <Plus class="size-3.5 mr-1" />Добавить переменную
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </Card>
          </TabsContent>

          <TabsContent
            value="settings"
            class="flex-1 min-h-0 mt-3 data-[state=inactive]:hidden"
          >
            <Card class="h-full flex flex-col overflow-hidden">
              <ScrollArea class="flex-1">
                <div class="p-4 space-y-4">
                  <div class="space-y-2">
                    <Label>Высота строки</Label>
                    <div class="flex flex-wrap items-center gap-3">
                      <Input
                        v-if="editor.rowSize !== 'zoom'"
                        :model-value="String(editor.rowSize)"
                        type="number"
                        class="w-24"
                        @update:model-value="
                          (v) => (editor.rowSize = v ? Number(v) || 40 : 40)
                        "
                      />
                      <Input v-else model-value="auto" disabled class="w-24" />
                      <div class="flex items-center gap-2">
                        <Checkbox
                          :model-value="editor.rowSize === 'zoom'"
                          @update:model-value="
                            (val) => (editor.rowSize = val ? 'zoom' : 40)
                          "
                        />
                        <Label class="font-normal">Зависит от zoom</Label>
                      </div>
                    </div>
                  </div>
                  <div class="space-y-2">
                    <Label>Runtime filters (persisted only)</Label>
                    <Input
                      :model-value="(editor.runtimeFilters ?? []).join(', ')"
                      @update:model-value="(value) => editor.runtimeFilters = String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean)"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label>Legacy setup source (data only)</Label>
                    <ScriptEditor v-model="editor.setupScript" :type="editor.type" />
                    <p class="text-xs text-muted-foreground">
                      This field is preserved in the document but is no longer executed.
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </Card>
          </TabsContent>

          <TabsContent
            value="assistant"
            class="flex-1 min-h-0 mt-3 data-[state=inactive]:hidden"
          >
            <Card class="h-full min-h-0 overflow-hidden py-0">
              <TableDataMappingAssistant />
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </template>
  </div>
</template>
