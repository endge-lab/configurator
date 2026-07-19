<script setup lang="ts">
import { DomainSectionType, Endge } from "@endge/core";
import { useDomainStore } from "@endge/ui-vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { toast } from "vue-sonner";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  autoFillAllColumns,
  autoFillColumn,
  buildAccessor,
} from "@/features/endge-ide/tools/table-editor-helper";
import { EndgeIDE } from "@/features/endge-ide/model/core/endge-ide.ts";
import DomainEntityDropTarget from "@/features/endge-ide/ui/components/DomainEntityDropTarget.vue";
import OpenEntityButton from "@/features/endge-ide/ui/components/OpenEntityButton.vue";
import { Bot, Loader2, LayoutGrid, Sparkles, Wand2 } from "lucide-vue-next";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { registerAgentTableAction } from "@/features/endge-ide/model/agent/agent-table-actions";

const assistanceApiUrl =
  (import.meta.env.VITE_ASSISTANCE_API_URL as string | undefined)?.trim() ?? "";

const domainStore = useDomainStore();
const editor = computed<any>(() => EndgeIDE.tabs.documentEditorModel.value ?? null);
const componentId = computed(() => normalizeText(editor.value?.id));

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function toNumericId(value: string): number | null {
  if (!/^-?\d+$/.test(value)) return null;
  const out = Number(value);
  return Number.isSafeInteger(out) ? out : null;
}

function resolveComponentByIdOrIdentity(ref: unknown): unknown | null {
  const normalized = normalizeText(ref);
  if (!normalized) return null;
  const byIdentity = Endge.domain.getComponentByIdentity(normalized);
  if (byIdentity) return byIdentity;
  const byRawId = Endge.domain.getComponentById(normalized);
  if (byRawId) return byRawId;
  const numericId = toNumericId(normalized);
  if (numericId == null) return null;
  return Endge.domain.getComponentById(numericId);
}

function resolveQueryByIdOrIdentity(ref: unknown): unknown | null {
  const normalized = normalizeText(ref);
  if (!normalized) return null;
  const byIdentity = Endge.domain.getQueryByIdentity(normalized);
  if (byIdentity) return byIdentity;
  const numericId = toNumericId(normalized);
  if (numericId == null) return null;
  return Endge.domain.getQueryById(numericId);
}

/** Список запросов для выбора в панели проверки */
const queryOptions = computed(() => {
  const list = domainStore.queries ?? [];
  return list
    .map((q: { identity?: string; id?: string; name?: string }) => ({
      value: q.identity ?? q.id ?? "",
      label: (q.name ?? q.identity ?? q.id) || "-",
    }))
    .filter((o: { value: string }) => o.value);
});

const selectedQueryId = ref<string | null>(null);
const runQueryLoading = ref(false);
const queryPanelCollapsed = ref(true);

/** После выполнения: ключ → массив (для словаря ключ:массив или один ключ для массива) */
const resultByKey = ref<Record<string, unknown[]>>({});
/** Ключи для вкладок (порядок) */
const resultKeys = computed(() => Object.keys(resultByKey.value));
/** subField запроса при последнем запуске (для построения пути) */
const runQuerySubField = ref<string>("");
/** Активная вкладка по ключу */
const activeTabKey = ref<string>("");

/** Ответ в виде массива: пример первого элемента (без ключей) */
const arraySample = ref<unknown | null>(null);
/** Полный массив при ответе-массиве (для демонстрации таблицы) */
const resultArray = ref<unknown[]>([]);

/** Есть ли вкладки (ключи словаря)? */
const hasTabs = computed(() => resultKeys.value.length > 0);

/** Есть ли данные для автозаполнения (запрос выполнен или восстановлен из localStorage) */
const hasSampleData = computed(
  () => resultKeys.value.length > 0 || arraySample.value != null,
);

/** Текущий образец одного элемента для автозаполнения (объект) */
const currentSampleObject = computed(() => {
  if (hasTabs.value) return sampleForTab.value;
  return arraySample.value;
});

/** Первый элемент массива по активному ключу */
const sampleForTab = computed(() => {
  const key = activeTabKey.value;
  const arr = resultByKey.value[key];
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr[0];
});

/** Рекурсивно собирает пути до примитивов в формате "a.b.c" */
function collectPaths(
  obj: unknown,
  prefix = "",
): { path: string; key: string }[] {
  if (obj === null || obj === undefined) return [];
  const out: { path: string; key: string }[] = [];
  if (typeof obj === "object" && !Array.isArray(obj)) {
    for (const key of Object.keys(obj)) {
      const full = prefix ? `${prefix}.${key}` : key;
      const val = (obj as Record<string, unknown>)[key];
      const isLeaf =
        val === null || typeof val !== "object" || Array.isArray(val);
      if (isLeaf) out.push({ path: full, key });
      else out.push(...collectPaths(val, full));
    }
  }
  return out;
}

type PathMeta = { path: string; types: string[]; samples: string[] };

function detectValueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  return typeof value;
}

function collectPathMeta(
  value: unknown,
  prefix: string,
  out: Map<string, { types: Set<string>; samples: Set<string> }>,
): void {
  if (value === null || value === undefined) {
    if (!prefix) return;
    const prev = out.get(prefix) ?? {
      types: new Set<string>(),
      samples: new Set<string>(),
    };
    prev.types.add("null");
    prev.samples.add("null");
    out.set(prefix, prev);
    return;
  }
  if (Array.isArray(value)) {
    if (!prefix) return;
    const prev = out.get(prefix) ?? {
      types: new Set<string>(),
      samples: new Set<string>(),
    };
    prev.types.add("array");
    if (value.length) {
      const sample = JSON.stringify(value[0]).slice(0, 80);
      if (sample) prev.samples.add(sample);
    }
    out.set(prefix, prev);
    return;
  }
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(rec)) {
      const next = prefix ? `${prefix}.${key}` : key;
      collectPathMeta(child, next, out);
    }
    return;
  }
  if (!prefix) return;
  const prev = out.get(prefix) ?? {
    types: new Set<string>(),
    samples: new Set<string>(),
  };
  prev.types.add(detectValueType(value));
  const sample = String(value).slice(0, 80);
  if (sample) prev.samples.add(sample);
  out.set(prefix, prev);
}

function buildPathCatalogFromRows(
  rows: Record<string, unknown>[],
  maxLines = 120,
): PathMeta[] {
  const out = new Map<string, { types: Set<string>; samples: Set<string> }>();
  for (const row of rows) {
    collectPathMeta(row, "", out);
  }
  return [...out.entries()]
    .map(([path, meta]) => ({
      path,
      types: [...meta.types].sort(),
      samples: [...meta.samples].slice(0, 2),
    }))
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, maxLines);
}

function buildPathCatalogText(catalog: PathMeta[]): string {
  if (!catalog.length) return "(не найдено путей в образцах данных)";
  return catalog
    .map((x) => {
      const types = x.types.length ? x.types.join("|") : "unknown";
      const sample = x.samples.length
        ? `, sample: ${x.samples.join(" | ")}`
        : "";
      return `- ${x.path} (type: ${types}${sample})`;
    })
    .join("\n");
}

/** До 3 строк данных для промпта: это даёт модели лучшее понимание структуры ответа. */
function getRowsForLlmPrompt(): Record<string, unknown>[] {
  if (hasTabs.value) {
    const arr = resultByKey.value[activeTabKey.value];
    if (Array.isArray(arr)) {
      return arr
        .filter(
          (x): x is Record<string, unknown> =>
            x != null && typeof x === "object" && !Array.isArray(x),
        )
        .slice(0, 3);
    }
  }
  if (Array.isArray(resultArray.value) && resultArray.value.length) {
    return resultArray.value
      .filter(
        (x): x is Record<string, unknown> =>
          x != null && typeof x === "object" && !Array.isArray(x),
      )
      .slice(0, 3);
  }
  const sample = currentSampleObject.value;
  if (sample != null && typeof sample === "object" && !Array.isArray(sample))
    return [sample as Record<string, unknown>];
  return [];
}

/** Пути в примере одного элемента для активной вкладки (кликабельные поля) */
const samplePaths = computed(() => {
  const data = hasTabs.value ? sampleForTab.value : arraySample.value;
  if (!data || typeof data !== "object") return [];
  return collectPaths(data).filter((p) => p.path !== "");
});

function getQueryIdLsKey(): string | null {
  const id = componentId.value;
  if (!id) return null;
  return `endge:admin:${id}.help-query-id`;
}

function getQueryValueLsKey(): string | null {
  const id = componentId.value;
  if (!id) return null;
  return `endge:admin:${id}.help-query-value`;
}

function persistQuerySelectionAndSample(): void {
  const idKey = getQueryIdLsKey();
  const valueKey = getQueryValueLsKey();
  if (!idKey || !valueKey) return;

  try {
    const qId = selectedQueryId.value;
    if (qId) localStorage.setItem(idKey, qId);
  } catch {}

  try {
    const firstByKey: Record<string, unknown> = {};
    const keys = Object.keys(resultByKey.value);
    for (const k of keys) {
      const arr = resultByKey.value[k];
      if (Array.isArray(arr) && arr.length) firstByKey[k] = arr[0];
    }
    if (!keys.length && arraySample.value != null) {
      firstByKey.__array = arraySample.value;
    }
    localStorage.setItem(valueKey, JSON.stringify(firstByKey));
  } catch {}
}

function restoreFromLocalStorage(): void {
  const idKey = getQueryIdLsKey();
  const valueKey = getQueryValueLsKey();
  if (!idKey || !valueKey) return;

  try {
    const savedId = localStorage.getItem(idKey);
    if (savedId) selectedQueryId.value = savedId;
  } catch {}

  try {
    const raw = localStorage.getItem(valueKey);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, unknown[]> = {};
    let restoredArray: unknown | null = null;
    const allKeys = Object.keys(parsed);

    // Миграция старого формата: { data: firstItem } для простого массива
    if (
      allKeys.length === 1 &&
      allKeys[0] === "data" &&
      parsed.data != null &&
      !parsed.__array
    ) {
      restoredArray = parsed.data;
    } else {
      for (const key of allKeys) {
        if (key === "__array") restoredArray = parsed[key];
        else out[key] = [parsed[key]];
      }
    }
    resultByKey.value = out;
    arraySample.value = restoredArray;
    const keys = Object.keys(out);
    if (keys.length && !activeTabKey.value) activeTabKey.value = keys[0] ?? "";

    const qId = normalizeText(selectedQueryId.value);
    if (qId) {
      const q = resolveQueryByIdOrIdentity(qId);
      if (q)
        runQuerySubField.value = (q as { subField?: string }).subField ?? "";
    }

    EndgeIDE.demonstration.setHelpData({
      queryIdentity: selectedQueryId.value ?? "",
      resultByKey: resultByKey.value,
      arraySample: arraySample.value,
      activeTabKey:
        (activeTabKey.value || Object.keys(resultByKey.value)[0]) ?? "data",
    });

    queryPanelCollapsed.value = false;
  } catch {}
}

/** Выполнить запрос, заполнить resultByKey и вкладки (использует общий runQueryAndSetHelpData). */
async function executeQuery(): Promise<void> {
  const id = normalizeText(selectedQueryId.value);
  if (!id) {
    toast.error("Выберите запрос");
    return;
  }
  runQueryLoading.value = true;
  resultByKey.value = {};
  arraySample.value = null;
  resultArray.value = [];
  activeTabKey.value = "";
  try {
    const help = await EndgeIDE.demonstration.runQueryAndSetHelpData(id);
    if (help) {
      resultByKey.value = help.resultByKey;
      arraySample.value = help.arraySample;
      activeTabKey.value = help.activeTabKey;
      if (Array.isArray(help.resultByKey[help.activeTabKey]))
        resultArray.value = help.resultByKey[help.activeTabKey] as unknown[];
      const query = resolveQueryByIdOrIdentity(id);
      runQuerySubField.value = (query as { subField?: string })?.subField ?? "";
      persistQuerySelectionAndSample();
      if (queryPanelCollapsed.value) queryPanelCollapsed.value = false;
    }
  } finally {
    runQueryLoading.value = false;
  }
}

/** По клику на поле примера - проставить accessor текущей колонки (строка dataPath) */
function setAccessorFromPath(path: string): void {
  const ed = editor.value;
  const col = ed?.selectedColumn;
  if (!col) {
    toast.error("Выберите колонку в редакторе таблицы");
    return;
  }
  const sub = runQuerySubField.value?.trim();
  let accessor: string;
  if (hasTabs.value) {
    const key = activeTabKey.value;
    if (!key) return;
    accessor = sub
      ? `$store.${sub}.${key}[$i].${path}`
      : `$store.${key}[$i].${path}`;
  } else {
    accessor = sub ? `$store.${sub}[$i].${path}` : `$store[$i].${path}`;
  }
  if (!col.accessors?.length) {
    toast.error("Добавьте хотя бы одну строку привязки данных в колонке");
    return;
  }
  const idx = Math.max(
    0,
    Math.min(col.selectedAccessorIndex ?? 0, col.accessors.length - 1),
  );
  col.accessors[idx].accessor = accessor;
  const nextIdx = Math.min(idx + 1, col.accessors.length - 1);
  col.selectedAccessorIndex = nextIdx;
  toast.success("Путь подставлен, фокус на следующей строке");
}

function getAutoFillOpts() {
  const sample = currentSampleObject.value;
  const obj =
    sample != null && typeof sample === "object" && !Array.isArray(sample)
      ? (sample as Record<string, unknown>)
      : null;
  return {
    sample: obj,
    subField: runQuerySubField.value?.trim(),
    tabKey: activeTabKey.value,
    hasTabs: hasTabs.value,
  };
}

/** Пересобрать строки accessors колонки по inputFields связного компонента (если есть) */
function resetAccessorsFromComponent(col: any): void {
  if (!col?.componentId) return;
  const component = Endge.domain.getComponent(col.componentId);
  const inputFields = (component as any)?.inputFields as
    | Record<string, { name?: string }>
    | undefined;
  if (!inputFields) return;

  const next: Array<{ name: string; accessor: string; converter: string }> = [];
  for (const field of Object.values(inputFields)) {
    const name = (field as any)?.name ?? "";
    if (!name) continue;
    next.push({
      name: String(name),
      accessor: "",
      converter: "",
    });
  }
  if (!next.length) return;

  col.accessors = next;
  if (typeof col.selectedAccessorIndex === "number")
    col.selectedAccessorIndex = 0;
}

/** Автозаполнение dataPaths только для открытой колонки */
function autoFillCurrentColumn(): void {
  const ed = editor.value;
  const col = ed?.selectedColumn as any;
  if (!col) {
    toast.error("Выберите колонку в редакторе таблицы");
    return;
  }
  const opts = getAutoFillOpts();
  if (!opts.sample) {
    toast.error("Нет данных запроса для подстановки");
    return;
  }

  // Сбросить текущие строки и взять поля по inputFields связного компонента (если есть)
  resetAccessorsFromComponent(col);

  const fieldTypes: Record<string, string> = {};
  // Если есть связной компонент - возьмём типы его inputFields по имени
  if (col.componentId) {
    const component = Endge.domain.getComponent(col.componentId);
    const inputFields = (component as any)?.inputFields as
      | Record<string, { type: string }>
      | undefined;
    if (inputFields) {
      for (const [name, field] of Object.entries(inputFields)) {
        if (field && typeof (field as any).type === "string")
          fieldTypes[name] = (field as any).type;
      }
    }
  }
  const filled = autoFillColumn(
    {
      accessors: col.accessors ?? [],
      title: col.title,
      fieldTypes,
    },
    opts,
  );
  toast.success(`Подставлено полей: ${filled}`);
}

/** Автозаполнение dataPaths по всем колонкам */
function autoFillAllColumnsTable(): void {
  const ed = editor.value;
  if (!ed?.columns?.length) {
    toast.error("Нет колонок в таблице");
    return;
  }
  const opts = getAutoFillOpts();
  if (!opts.sample) {
    toast.error("Нет данных запроса для подстановки");
    return;
  }
  const wrappers = (ed.columns ?? []).map((col: any) => {
    // Сбросить текущие строки по inputFields связного компонента (если есть)
    resetAccessorsFromComponent(col);

    const fieldTypes: Record<string, string> = {};
    if (col.componentId) {
      const component = Endge.domain.getComponent(col.componentId);
      const inputFields = (component as any)?.inputFields as
        | Record<string, { type: string }>
        | undefined;
      if (inputFields) {
        for (const [name, field] of Object.entries(inputFields)) {
          if (field && typeof (field as any).type === "string")
            fieldTypes[name] = (field as any).type;
        }
      }
    }
    return {
      accessors: col.accessors ?? [],
      title: col.title,
      fieldTypes,
    };
  });
  const filled = autoFillAllColumns({ columns: wrappers }, opts);
  toast.success(`Подставлено полей по всем колонкам: ${filled}`);
}

const llmFillLoading = ref(false);

/** Компактное описание конвертеров домена для промпта (identity: название — описание). */
function getConverterSummary(): string {
  const list = Endge.domain.getConverters();
  return (
    list
      .map((c: any) => {
        const id = c.identity ?? c.id ?? "";
        const name = c.name ?? id;
        const desc = c.description ?? "";
        return desc ? `${id}: ${name} — ${desc}` : `${id}: ${name}`;
      })
      .filter(Boolean)
      .join("\n") || "(нет конвертеров в домене)"
  );
}

/** Парсит маппинг поля: строка = только path, объект = { path, converter? }. */
function parseFieldMapping(
  val: unknown,
): { path: string; converter: string } | null {
  if (val == null) return null;
  if (typeof val === "string") return { path: val.trim(), converter: "" };
  if (typeof val === "object" && !Array.isArray(val)) {
    const o = val as Record<string, unknown>;
    const path =
      typeof o.path === "string"
        ? o.path.trim()
        : typeof o.accessor === "string"
          ? o.accessor.trim()
          : "";
    if (!path) return null;
    const converter = typeof o.converter === "string" ? o.converter.trim() : "";
    return { path, converter };
  }
  return null;
}

/** Извлечь JSON-объект из ответа модели (markdown ```json ... ``` или сырой {...}). */
function extractJsonFromMessage(text: string): Record<string, unknown> | null {
  const raw = String(text ?? "").trim();
  const codeMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const str = codeMatch ? (codeMatch[1] ?? "").trim() : raw;
  try {
    const parsed = JSON.parse(str) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Подставить dataPaths для открытой колонки через LLM: запрос (если нет примера) → ответ модели → маппинг полей. */
async function autoFillCurrentColumnViaLLM(): Promise<void> {
  if (!assistanceApiUrl) {
    toast.error("Сервис ассистента не настроен (VITE_ASSISTANCE_API_URL)");
    return;
  }
  const ed = editor.value;
  const col = ed?.selectedColumn as any;
  if (!col) {
    toast.error("Выберите колонку в редакторе таблицы");
    return;
  }
  if (!hasSampleData.value) {
    if (!selectedQueryId.value) {
      toast.error(
        "Выберите запрос и выполните его или подставьте данные для примера",
      );
      return;
    }
    await executeQuery();
  }
  let sample = currentSampleObject.value;
  if (Array.isArray(sample) && sample.length) sample = sample[0];
  const obj =
    sample != null && typeof sample === "object" && !Array.isArray(sample)
      ? (sample as Record<string, unknown>)
      : null;
  if (!obj) {
    toast.error("Нет данных запроса для подстановки");
    return;
  }

  resetAccessorsFromComponent(col);
  const fieldTypes: Record<string, string> = {};
  if (col.componentId) {
    const component = Endge.domain.getComponent(col.componentId);
    const inputFields = (component as any)?.inputFields as
      | Record<string, { type?: string }>
      | undefined;
    if (inputFields) {
      for (const [name, field] of Object.entries(inputFields)) {
        if (field && typeof (field as any).type === "string")
          fieldTypes[name] = (field as any).type;
      }
    }
  }
  const accessors = col.accessors ?? [];
  if (!accessors.length) {
    toast.error(
      "Добавьте строки привязки данных в колонке (или выберите компонент)",
    );
    return;
  }
  const fields = accessors.map((acc: { name?: string }) => ({
    name: (acc.name ?? "").trim() || "value",
    type:
      fieldTypes[acc.name ?? ""] ?? fieldTypes[(acc as any).name] ?? "unknown",
  }));

  const columnTitle = (col.title ?? "").trim() || "(без названия)";
  const converterSummary = getConverterSummary();
  const rowsForPrompt = getRowsForLlmPrompt();
  const promptRows = rowsForPrompt.length ? rowsForPrompt : [obj];
  const pathCatalog = buildPathCatalogFromRows(promptRows);
  const pathCatalogText = buildPathCatalogText(pathCatalog);
  const userMessage = `Задача: максимально точно сопоставить поля открытой колонки таблицы с путями данных текущего запроса.

ВАЖНО:
1) Используй ТОЛЬКО пути из раздела "Доступные пути (path catalog)".
2) Название колонки + имя поля — главный сигнал для выбора.
3) Если тип значения и тип поля совпадают, converter не ставь.
4) Converter ставь только при реальном конфликте типов и только из списка "Доступные конвертеры".
5) Не придумывай несуществующие пути и конвертеры.

Колонка:
- title: "${columnTitle}"
- fields: ${JSON.stringify(fields, null, 2)}

Текущие данные запроса (до 3 строк):
${JSON.stringify(promptRows, null, 2)}

Доступные пути (path catalog):
${pathCatalogText}

Доступные конвертеры (identity):
${converterSummary}

Формат ответа:
- Один JSON-объект без markdown.
- Ключ верхнего уровня = имя поля.
- Значение = { "path": "<path>", "converter": "<identity или пусто>" }.
- Если converter не нужен, можно опустить его или передать "".`;

  const requestBody = {
    message: userMessage,
    model: "deepseek-v3.1:671b-cloud",
  };
  console.log(
    "[TableDataMappingAssistant autoFillCurrentColumnViaLLM] Запрос к агенту:",
    requestBody,
  );

  llmFillLoading.value = true;
  try {
    const res = await fetch(`${assistanceApiUrl}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    const msg = data.message ?? "";
    console.log(
      "[TableDataMappingAssistant autoFillCurrentColumnViaLLM] Ответ агента (сырой):",
      msg,
    );
    if (!res.ok) {
      toast.error(msg || `Ошибка ${res.status}`);
      return;
    }
    const mapping = extractJsonFromMessage(msg);
    if (mapping && Object.keys(mapping).length)
      console.log(
        "[TableDataMappingAssistant autoFillCurrentColumnViaLLM] Распарсенный маппинг:",
        mapping,
      );
    else
      console.warn(
        "[TableDataMappingAssistant autoFillCurrentColumnViaLLM] Не удалось распарсить маппинг из ответа, msg:",
        msg,
      );
    if (!mapping || !Object.keys(mapping).length) {
      toast.error("Не удалось разобрать маппинг из ответа модели");
      return;
    }
    const opts = getAutoFillOpts();
    let filled = 0;
    for (const acc of accessors) {
      const name = (acc.name ?? "").trim() || "value";
      const raw = mapping[name] ?? mapping[acc.name];
      const parsed = parseFieldMapping(raw);
      if (parsed?.path) {
        acc.accessor = buildAccessor(parsed.path, opts);
        const conv = (parsed.converter ?? "").trim();
        if (conv && conv.toLowerCase() !== "identity") acc.converter = conv;
        filled++;
      }
    }
    toast.success(`Подставлено полей через LLM: ${filled}`);
  } finally {
    llmFillLoading.value = false;
  }
}

/** Подставить dataPaths и конвертеры для всех колонок таблицы одним запросом к LLM. */
async function autoFillAllColumnsViaLLM(): Promise<void> {
  if (!assistanceApiUrl) {
    toast.error("Сервис ассистента не настроен (VITE_ASSISTANCE_API_URL)");
    return;
  }
  const ed = editor.value;
  if (!ed?.columns?.length) {
    toast.error("Нет колонок в таблице");
    return;
  }
  if (!hasSampleData.value) {
    if (!selectedQueryId.value) {
      toast.error(
        "Выберите запрос и выполните его или подставьте данные для примера",
      );
      return;
    }
    await executeQuery();
  }
  let sample = currentSampleObject.value;
  if (Array.isArray(sample) && sample.length) sample = sample[0];
  const obj =
    sample != null && typeof sample === "object" && !Array.isArray(sample)
      ? (sample as Record<string, unknown>)
      : null;
  if (!obj) {
    toast.error("Нет данных запроса для подстановки");
    return;
  }

  const converterSummary = getConverterSummary();
  const columnsMeta: Array<{
    index: number;
    id: string;
    title: string;
    fields: Array<{ name: string; type: string }>;
  }> = [];
  for (let i = 0; i < ed.columns.length; i++) {
    const col = ed.columns[i] as any;
    resetAccessorsFromComponent(col);
    const fieldTypes: Record<string, string> = {};
    if (col.componentId) {
      const component = Endge.domain.getComponent(col.componentId);
      const inputFields = (component as any)?.inputFields as
        | Record<string, { type?: string }>
        | undefined;
      if (inputFields) {
        for (const [name, field] of Object.entries(inputFields)) {
          if (field && typeof (field as any).type === "string")
            fieldTypes[name] = (field as any).type;
        }
      }
    }
    const accessors = col.accessors ?? [];
    const fields = accessors.map((acc: { name?: string }) => ({
      name: (acc.name ?? "").trim() || "value",
      type:
        fieldTypes[acc.name ?? ""] ??
        fieldTypes[(acc as any).name] ??
        "unknown",
    }));
    if (fields.length)
      columnsMeta.push({
        index: i,
        id: col.id,
        title: col.title ?? col.id,
        fields,
      });
  }
  if (!columnsMeta.length) {
    toast.error("Нет колонок с полями для привязки");
    return;
  }

  const rowsForPrompt = getRowsForLlmPrompt();
  const promptRows = rowsForPrompt.length ? rowsForPrompt : [obj];
  const pathCatalog = buildPathCatalogFromRows(promptRows);
  const pathCatalogText = buildPathCatalogText(pathCatalog);
  const columnsBlock = columnsMeta
    .map(
      (c) =>
        `Колонка ${c.index}, название "${(c.title ?? "").trim() || "(без названия)"}": поля ${JSON.stringify(c.fields)}`,
    )
    .join("\n");
  const userMessage = `Задача: сопоставить dataPath и converter для всех колонок таблицы по текущему ответу запроса.

ВАЖНО:
1) Используй ТОЛЬКО пути из раздела "Доступные пути (path catalog)".
2) Для каждой колонки учитывай её title и типы полей.
3) Converter ставь только при несовпадении типов.
4) Converter выбирай ТОЛЬКО из списка "Доступные конвертеры".
5) Не придумывай пути/конвертеры, которых нет в контексте.

Текущие данные запроса (до 3 строк):
${JSON.stringify(promptRows, null, 2)}

Доступные пути (path catalog):
${pathCatalogText}

Колонки (индекс, title, поля):
${columnsBlock}

Доступные конвертеры (identity):
${converterSummary}

Формат ответа:
- Один JSON-объект без markdown.
- Ключи верхнего уровня: "0", "1", "2", ... (индекс колонки).
- Значение: объект вида
  { "fieldName": { "path": "<path>", "converter": "<identity или пусто>" } }.
- Если converter не нужен, можно опустить его или передать "".`;

  const requestBody = {
    message: userMessage,
    model: "deepseek-v3.1:671b-cloud",
  };
  console.log(
    "[TableDataMappingAssistant autoFillAllColumnsViaLLM] Запрос к агенту:",
    requestBody,
  );

  llmFillLoading.value = true;
  try {
    const res = await fetch(`${assistanceApiUrl}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    const msg = data.message ?? "";
    console.log(
      "[TableDataMappingAssistant autoFillAllColumnsViaLLM] Ответ агента (сырой):",
      msg,
    );
    if (!res.ok) {
      toast.error(msg || `Ошибка ${res.status}`);
      return;
    }
    const mappingAll = extractJsonFromMessage(msg);
    if (!mappingAll || typeof mappingAll !== "object") {
      toast.error("Не удалось разобрать ответ модели");
      return;
    }
    if (Object.keys(mappingAll).length)
      console.log(
        "[TableDataMappingAssistant autoFillAllColumnsViaLLM] Распарсенный маппинг по колонкам:",
        mappingAll,
      );

    const opts = getAutoFillOpts();
    let totalFilled = 0;
    for (const { index } of columnsMeta) {
      const col = ed.columns[index] as any;
      if (!col) continue;
      const rowMapping = mappingAll[String(index)] ?? mappingAll[index];
      if (
        rowMapping == null ||
        typeof rowMapping !== "object" ||
        Array.isArray(rowMapping)
      )
        continue;
      const accessors = col.accessors ?? [];
      for (const acc of accessors) {
        const name = (acc.name ?? "").trim() || "value";
        const raw =
          (rowMapping as Record<string, unknown>)[name] ??
          (rowMapping as Record<string, unknown>)[acc.name];
        const parsed = parseFieldMapping(raw);
        if (parsed?.path) {
          acc.accessor = buildAccessor(parsed.path, opts);
          const conv = (parsed.converter ?? "").trim();
          if (conv && conv.toLowerCase() !== "identity") acc.converter = conv;
          totalFilled++;
        }
      }
    }
    toast.success(
      `Подставлено полей по всей таблице через LLM: ${totalFilled}`,
    );
  } finally {
    llmFillLoading.value = false;
  }
}

const _unregAgentTable: (() => void)[] = [];
onMounted(() => {
  _unregAgentTable.push(
    registerAgentTableAction("auto_fill_datapaths", () =>
      autoFillAllColumnsViaLLM(),
    ),
  );
});
onBeforeUnmount(() => {
  _unregAgentTable.forEach((u) => u());
});

watch(
  () => editor.value,
  (val) => {
    if (val) {
      queryPanelCollapsed.value = false;
      restoreFromLocalStorage();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div
    v-if="!editor"
    class="flex items-center justify-center h-full text-sm text-muted-foreground"
  >
    Выберите документ
  </div>
  <div v-else class="flex flex-col h-full min-h-0">
    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <!-- Панель проверки запроса: выбор запроса, Выполнить, JSON первого элемента -->
        <div class="space-y-2 border-t pt-4">
          <button
            type="button"
            class="flex items-center gap-2 w-full text-left text-sm font-medium text-foreground hover:opacity-80"
            @click="queryPanelCollapsed = !queryPanelCollapsed"
          >
            <span
              class="transition-transform"
              :class="queryPanelCollapsed ? '' : 'rotate-90'"
              >▶</span
            >
            Помощь
          </button>
          <template v-if="!queryPanelCollapsed">
            <DomainEntityDropTarget
              :accept-section-types="[DomainSectionType.Query]"
              @update:model-value="
                (id) => (selectedQueryId = id != null ? String(id) : null)
              "
            >
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground"
                  >Запрос</label
                >
                <div class="flex items-center gap-1">
                  <Select
                    :model-value="selectedQueryId ?? undefined"
                    @update:model-value="
                      (v) => (selectedQueryId = v != null ? String(v) : null)
                    "
                  >
                    <SelectTrigger class="h-9 flex-1 min-w-0">
                      <SelectValue placeholder="Выберите запрос…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="opt in queryOptions"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <OpenEntityButton
                    :entity-id="selectedQueryId"
                    :section-type="DomainSectionType.Query"
                  />
                </div>
                <Button
                  class="w-full"
                  :disabled="runQueryLoading || !selectedQueryId"
                  @click="executeQuery"
                >
                  {{ runQueryLoading ? "Выполнение…" : "Выполнить" }}
                </Button>
                <template v-if="resultKeys.length">
                  <Tabs
                    :model-value="activeTabKey"
                    @update:model-value="
                      (v) => (activeTabKey = v != null ? String(v) : '')
                    "
                    class="w-full"
                  >
                    <TabsList class="w-full flex flex-wrap h-auto gap-1 p-1">
                      <TabsTrigger
                        v-for="k in resultKeys"
                        :key="k"
                        :value="k"
                        class="text-xs"
                      >
                        {{ k }}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent
                      v-for="k in resultKeys"
                      :key="k"
                      :value="k"
                      class="mt-2 rounded-md border bg-muted/30 p-3 space-y-2"
                    >
                      <p class="text-xs font-medium text-muted-foreground">
                        Первый элемент массива «{{ k }}» - нажмите на поле,
                        чтобы подставить путь в accessor колонки
                      </p>
                      <pre
                        class="text-xs overflow-auto max-h-36 whitespace-pre-wrap"
                        >{{
                          sampleForTab != null
                            ? JSON.stringify(sampleForTab, null, 2)
                            : "-"
                        }}</pre
                      >
                      <div class="flex flex-wrap gap-1.5">
                        <button
                          v-for="item in samplePaths"
                          :key="item.path"
                          type="button"
                          class="inline-flex px-2 py-1 rounded text-xs bg-muted hover:bg-primary/20 border border-transparent hover:border-primary/50 transition-colors"
                          :title="`Подставить $store.${runQuerySubField ? runQuerySubField + '.' : ''}${activeTabKey}[$i].${item.path}`"
                          @click="setAccessorFromPath(item.path)"
                        >
                          {{ item.path }}
                        </button>
                      </div>
                      <div
                        v-if="hasSampleData"
                        class="pt-2 flex items-center gap-2"
                      >
                        <TooltipProvider :delay-duration="300">
                          <Tooltip>
                            <TooltipTrigger as-child>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                class="shrink-0 size-9"
                                aria-label="Автозаполнение для открытой колонки"
                                @click="autoFillCurrentColumn"
                              >
                                <Wand2 class="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" class="max-w-[220px]">
                              Автоматически подставить все dataPaths только для
                              открытой колонки по данным запроса
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger as-child>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                class="shrink-0 size-9"
                                aria-label="Автозаполнение по всем колонкам"
                                @click="autoFillAllColumnsTable"
                              >
                                <Sparkles class="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" class="max-w-[220px]">
                              Автоматически настроить dataPaths для всех колонок
                              по данным запроса
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger as-child>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                class="shrink-0 size-9"
                                aria-label="Подставить через LLM (открытая колонка)"
                                :disabled="llmFillLoading"
                                @click="autoFillCurrentColumnViaLLM"
                              >
                                <Loader2
                                  v-if="llmFillLoading"
                                  class="size-4 animate-spin"
                                />
                                <Bot v-else class="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" class="max-w-[260px]">
                              Подставить dataPaths и конвертеры для открытой
                              колонки через LLM
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger as-child>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                class="shrink-0 size-9"
                                aria-label="Подставить через LLM для всей таблицы"
                                :disabled="llmFillLoading"
                                @click="autoFillAllColumnsViaLLM"
                              >
                                <Loader2
                                  v-if="llmFillLoading"
                                  class="size-4 animate-spin"
                                />
                                <LayoutGrid v-else class="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" class="max-w-[260px]">
                              Подставить dataPaths и конвертеры для всех колонок
                              одним запросом к LLM
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TabsContent>
                  </Tabs>
                </template>
                <template v-else-if="arraySample">
                  <div class="mt-2 rounded-md border bg-muted/30 p-3 space-y-2">
                    <p class="text-xs font-medium text-muted-foreground">
                      Первый элемент массива - нажмите на поле, чтобы подставить
                      путь в accessor колонки
                    </p>
                    <pre
                      class="text-xs overflow-auto max-h-36 whitespace-pre-wrap"
                      >{{
                        arraySample != null
                          ? JSON.stringify(arraySample, null, 2)
                          : "-"
                      }}</pre
                    >
                    <div class="flex flex-wrap gap-1.5">
                      <button
                        v-for="item in samplePaths"
                        :key="item.path"
                        type="button"
                        class="inline-flex px-2 py-1 rounded text-xs bg-muted hover:bg-primary/20 border border-transparent hover:border-primary/50 transition-colors"
                        :title="`Подставить $store.${runQuerySubField ? runQuerySubField + '.' : ''}[$i].${item.path}`"
                        @click="setAccessorFromPath(item.path)"
                      >
                        {{ item.path }}
                      </button>
                    </div>
                    <div
                      v-if="hasSampleData"
                      class="pt-2 flex items-center gap-2"
                    >
                      <TooltipProvider :delay-duration="300">
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              class="shrink-0 size-9"
                              aria-label="Автозаполнение для открытой колонки"
                              @click="autoFillCurrentColumn"
                            >
                              <Wand2 class="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" class="max-w-[220px]">
                            Автоматически подставить все dataPaths только для
                            открытой колонки по данным запроса
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              class="shrink-0 size-9"
                              aria-label="Автозаполнение по всем колонкам"
                              @click="autoFillAllColumnsTable"
                            >
                              <Sparkles class="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" class="max-w-[220px]">
                            Автоматически настроить dataPaths для всех колонок
                            по данным запроса
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              class="shrink-0 size-9"
                              aria-label="Подставить через LLM (открытая колонка)"
                              :disabled="llmFillLoading"
                              @click="autoFillCurrentColumnViaLLM"
                            >
                              <Loader2
                                v-if="llmFillLoading"
                                class="size-4 animate-spin"
                              />
                              <Bot v-else class="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" class="max-w-[260px]">
                            Подставить dataPaths и конвертеры для открытой
                            колонки через LLM
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              class="shrink-0 size-9"
                              aria-label="Подставить через LLM для всей таблицы"
                              :disabled="llmFillLoading"
                              @click="autoFillAllColumnsViaLLM"
                            >
                              <Loader2
                                v-if="llmFillLoading"
                                class="size-4 animate-spin"
                              />
                              <LayoutGrid v-else class="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" class="max-w-[260px]">
                            Подставить dataPaths и конвертеры для всех колонок
                            одним запросом к LLM
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </template>
              </div>
            </DomainEntityDropTarget>
          </template>
        </div>
      </div>
    </ScrollArea>

  </div>
</template>
