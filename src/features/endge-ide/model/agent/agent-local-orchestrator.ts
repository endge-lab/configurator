import type {
  FrontendAction,
  FrontendNeed,
  FrontendRequest,
} from "@/features/endge-ide/model/agent/agent-frontend-request";

export interface LocalOrchestratorEntity {
  identity: string;
  displayName: string;
  documentType: string;
  entityType: string;
}

export interface LocalOrchestratorInput {
  message: string;
  entities: LocalOrchestratorEntity[];
  activeDocument?: {
    documentType?: string | null;
    identity?: string | null;
  } | null;
}

export interface LocalOrchestratorResult {
  request: FrontendRequest;
  summary: string;
}

type DocumentHint =
  | "table"
  | "dsl"
  | "view"
  | "query"
  | "component"
  | "document";
type RuntimeHint =
  | "component"
  | "query"
  | "view"
  | "action"
  | "page"
  | "project"
  | null;

interface RankedEntity {
  entity: LocalOrchestratorEntity;
  score: number;
}

const OPEN_VERB_RE = /\b(открой|покажи|перейди|open|show|switch)\b/i;
const COMMAND_VERB_RE =
  /\b(открой|покажи|перейди|запусти|создай|добавь|удали|очисти|подставь|свяжи|скопируй|дублируй|open|show|go|run|start|create|add|remove|clear|copy|duplicate)\b/i;
const QUESTION_RE =
  /^(что|как|какие|какой|какая|почему|зачем|когда|где|what|how|why|when|where)\b/i;
const RUNTIME_RE = /\b(runtime|рантайм)\b/i;
const DUPLICATE_RE = /\b(скопируй|дублируй|copy|duplicate)\b/i;
const ADD_COLUMN_RE =
  /\b(добавь|создай|add|create)\b.*\b(колонк|столбец|column)\b/i;
const REMOVE_COLUMN_RE =
  /\b(удали|убери|remove|delete)\b.*\b(колонк|столбец|column)\b/i;
const CLEAR_DATAPATH_RE =
  /\b(очисти|сбрось|clear|reset)\b.*\b(data[\s-]*path|привязк|accessor|аксессор)\b/i;
const AUTOFILL_DATAPATH_RE =
  /\b(подставь|заполни|автозаполн|свяжи|auto[\s-]*fill|fill)\b.*\b(data[\s-]*path|данн|колонк|accessor)\b/i;

const OPEN_DOC_PREFIX_RE =
  /^(документ|таблиц[ауые]?|столбец|вид|запрос|компонент|component|table|view|query)\s+/i;
const DUPLICATE_DOC_PREFIX_RE =
  /^(документ|таблиц[ауые]?|вид|запрос|компонент|component|table|view|query)\s+/i;

const DUPLICATE_SUPPORTED_DOCUMENT_TYPES = new Set([
  "query-gql",
  "query-rest",
  "query-custom",
  "component-dsl",
  "component-table",
  "view",
  "action",
  "scenario-setup",
  "converter",
  "integration",
  "environment",
  "tenant",
  "policy",
  "style",
  "vocabs",
  "i18n-bundles",
  "auth-profile",
  "page",
  "page-template",
  "navigation",
  "type",
  "default-parameter",
  "default-filter",
]);

const WIDGET_ALIASES: Array<{
  widgetId: string;
  patterns: RegExp[];
  summary: string;
}> = [
  {
    widgetId: "inspector",
    patterns: [/\bинспектор\b/i, /\binspector\b/i],
    summary: "Открываю виджет Инспектор.",
  },
  {
    widgetId: "versions",
    patterns: [/\bверс(и|и)и\b/i, /\bversions?\b/i],
    summary: "Открываю виджет Версии.",
  },
  {
    widgetId: "project",
    patterns: [/\bпроект\b/i, /\bproject\b/i],
    summary: "Открываю виджет Проект.",
  },
  {
    widgetId: "settings",
    patterns: [/\bнастройк/i, /\bsettings?\b/i],
    summary: "Открываю виджет Настройки.",
  },
  {
    widgetId: "errors",
    patterns: [/\bошибк/i, /\berrors?\b/i],
    summary: "Открываю виджет Ошибки.",
  },
  {
    widgetId: "storage",
    patterns: [/\bхранилищ/i, /\bstorage\b/i],
    summary: "Открываю виджет Хранилище.",
  },
  {
    widgetId: "testing",
    patterns: [/\bтест/i, /\btesting\b/i],
    summary: "Открываю виджет Тестирование.",
  },
  {
    widgetId: "events",
    patterns: [/\bсобыти/i, /\bevents?\b/i],
    summary: "Открываю виджет События.",
  },
  {
    widgetId: "runtime-debug",
    patterns: [/\bruntime[\s-]*debug\b/i, /\bотладк/i],
    summary: "Открываю виджет Runtime Debug.",
  },
  {
    widgetId: "pulse",
    patterns: [/\bпульс\b/i, /\bpulse\b/i],
    summary: "Открываю виджет Пульс.",
  },
  {
    widgetId: "raph",
    patterns: [/\braph\b/i],
    summary: "Открываю виджет Raph.",
  },
  {
    widgetId: "help",
    patterns: [/\bдокументац/i, /\bhelp\b/i],
    summary: "Открываю виджет Документация.",
  },
  {
    widgetId: "agent",
    patterns: [/\bагент\b/i, /\bagent\b/i],
    summary: "Открываю виджет Агент.",
  },
  {
    widgetId: "demonstration",
    patterns: [/\bдемонстрац/i, /\bdemonstration\b/i],
    summary: "Открываю виджет Демонстрация.",
  },
];

const SINGLETON_ALIASES: Array<{
  viewId: string;
  patterns: RegExp[];
  summary: string;
}> = [
  {
    viewId: "view-generator",
    patterns: [/\bгенератор\b/i, /\bview[\s-]*generator\b/i],
    summary: "Открываю вкладку Генератор.",
  },
  {
    viewId: "dsl-playground",
    patterns: [/\bdsl[\s-]*песочниц/i, /\bdsl[\s-]*playground\b/i],
    summary: "Открываю вкладку DSL Playground.",
  },
  {
    viewId: "nova-sandbox",
    patterns: [/\bnova[\s-]*sandbox\b/i, /\bnova[\s-]*песочниц/i],
    summary: "Открываю вкладку Nova Sandbox.",
  },
  {
    viewId: "action-playgrounds",
    patterns: [/\baction[\s-]*playgrounds?\b/i],
    summary: "Открываю вкладку Action Playgrounds.",
  },
  {
    viewId: "table-benchmark",
    patterns: [/\btable[\s-]*benchmark\b/i, /\bбенчмарк\b/i],
    summary: "Открываю вкладку Table Benchmark.",
  },
  {
    viewId: "backup-restore",
    patterns: [/\bbackup[\s-]*restore\b/i, /\bрезервн/i],
    summary: "Открываю вкладку Backup Restore.",
  },
  {
    viewId: "demonstration",
    patterns: [/\bдемонстрац/i],
    summary: "Открываю вкладку Demonstration.",
  },
  {
    viewId: "pulse",
    patterns: [/\bпульс\b/i, /\bpulse\b/i],
    summary: "Открываю вкладку Пульс.",
  },
  {
    viewId: "domain-analysis",
    patterns: [/\banalysis\b/i, /\bпоиск проблем\b/i, /\bанализ домена\b/i],
    summary: "Открываю вкладку Domain Analysis.",
  },
  {
    viewId: "architecture",
    patterns: [/\bархитектур/i, /\barchitecture\b/i],
    summary: "Открываю вкладку Архитектура.",
  },
];

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  "component-table": "таблица",
  "component-dsl": "DSL-компонент",
  view: "вид",
  "query-gql": "GraphQL-запрос",
  "query-rest": "REST-запрос",
  "query-custom": "кастомный запрос",
  action: "действие",
  page: "страница",
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-я]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractQuotedParts(text: string): string[] {
  const out: string[] = [];
  const re = /["'«](.+?)["'»]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const part = m[1]?.trim();
    if (part) out.push(part);
  }
  return out;
}

function cleanTail(value: string): string {
  return value
    .replace(/^[\s:;,.!?-]+/, "")
    .replace(/[\s:;,.!?-]+$/, "")
    .trim();
}

function extractOpenName(text: string): string {
  const quoted = extractQuotedParts(text);
  if (quoted.length) return cleanTail(quoted[0] ?? "");
  const openMatch = text.match(
    /(?:открой|покажи|перейди(?:\s+к)?|open|show)\s+(.+)$/i,
  );
  if (!openMatch?.[1]) return "";
  return cleanTail(openMatch[1].replace(OPEN_DOC_PREFIX_RE, ""));
}

function extractColumnTitle(text: string): string {
  const quoted = extractQuotedParts(text);
  if (quoted.length) return cleanTail(quoted[0] ?? "");
  const m = text.match(/(?:колонк[ауые]?|столбец|column)\s+(.+)$/i);
  if (!m?.[1]) return "";
  return cleanTail(m[1]);
}

/** Возвращает zero-based индекс колонки из фразы вида «удали 3 колонку», «remove column 2», «удали column #4». */
function extractColumnIndex(text: string): number | null {
  const patterns = [
    /(?:удали|убери|remove|delete)\s+(?:колонк[ауые]?|столбец|column)\s*#?\s*(\d+)/i,
    /(?:удали|убери|remove|delete)\s+(\d+)(?:-ю|-й|-юю|-ую)?\s*(?:колонк[ауые]?|столбец|column)/i,
    /(?:колонк[ауые]?|столбец|column)\s*#?\s*(\d+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    const n = Number(m?.[1] ?? "");
    if (Number.isInteger(n) && n > 0) return n - 1;
  }
  return null;
}

function isRemoveAllColumnsIntent(text: string): boolean {
  const n = normalizeText(text);
  const hasRemove = /\b(удали|убери|remove|delete)\b/.test(n);
  const hasAll = /\b(все|all)\b/.test(n);
  const hasColumns = /\b(колонк|столбц|column|columns)\b/.test(n);
  return hasRemove && hasAll && hasColumns;
}

function extractDuplicateNames(text: string): {
  source: string;
  target: string;
} {
  const quoted = extractQuotedParts(text);
  if (quoted.length >= 2) {
    return {
      source: cleanTail(quoted[0] ?? ""),
      target: cleanTail(quoted[1] ?? ""),
    };
  }

  const explicit = text.match(
    /(?:скопируй|дублируй|copy|duplicate)\s+(.+?)\s+(?:как|в|to)\s+(.+)$/i,
  );
  if (explicit?.[1] && explicit[2]) {
    const source = cleanTail(explicit[1].replace(DUPLICATE_DOC_PREFIX_RE, ""));
    const target = cleanTail(explicit[2]);
    return { source, target };
  }

  const onlySource = text.match(
    /(?:скопируй|дублируй|copy|duplicate)\s+(.+)$/i,
  );
  const source = onlySource?.[1]
    ? cleanTail(onlySource[1].replace(DUPLICATE_DOC_PREFIX_RE, ""))
    : "";
  return { source, target: "" };
}

function makeIdentitySlug(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9а-я_-]+/gi, "")
    .replace(/^_+|_+$/g, "");
  if (!cleaned) return "";
  return /^\d/.test(cleaned) ? `copy_${cleaned}` : cleaned;
}

function isLikelyQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.endsWith("?")) return false;
  return QUESTION_RE.test(normalizeText(trimmed));
}

function hasPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function detectDocumentHint(normalized: string): DocumentHint {
  if (/\b(dsl|jsx)\b/.test(normalized)) return "dsl";
  if (/\b(таблиц|table)\b/.test(normalized)) return "table";
  if (/\b(вид|view)\b/.test(normalized)) return "view";
  if (/\b(запрос|query)\b/.test(normalized)) return "query";
  if (/\b(компонент|component)\b/.test(normalized)) return "component";
  return "document";
}

function scoreByHint(documentType: string, hint: DocumentHint): number {
  const isQuery = documentType.startsWith("query-");
  const isTable = documentType === "component-table";
  const isDsl = documentType === "component-dsl";
  const isView = documentType === "view";

  if (hint === "table") {
    if (isTable) return 40;
    if (isDsl) return -30;
    return -8;
  }
  if (hint === "dsl") {
    if (isDsl) return 45;
    if (isTable) return -30;
    return -8;
  }
  if (hint === "view") return isView ? 40 : -8;
  if (hint === "query") return isQuery ? 40 : -8;
  if (hint === "component") {
    if (isTable) return 24;
    if (isDsl) return 20;
    return -8;
  }

  if (isTable) return 18;
  if (isDsl) return 8;
  if (isView) return 6;
  if (isQuery) return 5;
  return 0;
}

function scoreNameMatch(
  candidate: LocalOrchestratorEntity,
  query: string,
  hint: DocumentHint,
): number {
  const q = normalizeText(query);
  if (!q) return 0;
  const idNorm = normalizeText(candidate.identity);
  const nameNorm = normalizeText(candidate.displayName);
  let score = 0;
  let strict = false;

  if (idNorm === q) {
    score += 120;
    strict = true;
  }
  if (nameNorm === q) {
    score += 130;
    strict = true;
  }
  if (idNorm.startsWith(q)) {
    score += 92;
    strict = true;
  }
  if (nameNorm.startsWith(q)) {
    score += 98;
    strict = true;
  }
  if (idNorm.includes(q)) {
    score += 72;
    strict = true;
  }
  if (nameNorm.includes(q)) {
    score += 80;
    strict = true;
  }

  let tokenHits = 0;
  for (const token of q.split(" ")) {
    if (token.length < 3) continue;
    if (idNorm.includes(token) || nameNorm.includes(token)) tokenHits++;
  }
  score += tokenHits * 4;

  if (!strict && tokenHits < 2) return 0;
  score += scoreByHint(candidate.documentType, hint);
  return score;
}

function rankEntities(
  entities: LocalOrchestratorEntity[],
  query: string,
  hint: DocumentHint,
): RankedEntity[] {
  const ranked: RankedEntity[] = [];
  for (const entity of entities) {
    const score = scoreNameMatch(entity, query, hint);
    if (score > 0) ranked.push({ entity, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

function toDocChoiceNeed(name: string, ranked: RankedEntity[]): FrontendNeed {
  const options = ranked.slice(0, 4).map((x) => ({
    documentType: x.entity.documentType,
    identity: x.entity.identity,
    label: `${DOCUMENT_TYPE_LABELS[x.entity.documentType] ?? x.entity.documentType}: ${x.entity.displayName || x.entity.identity}`,
  }));
  return {
    id: "open-document-choice",
    description: `Нашёл несколько документов для "${name}". Выберите нужный вариант.`,
    openDocumentChoiceOptions: options,
  };
}

function runtimeTypeByDocumentType(documentType: string): RuntimeHint {
  if (documentType.startsWith("query-")) return "query";
  if (documentType.startsWith("component-")) return "component";
  if (documentType === "view") return "view";
  if (documentType === "action") return "action";
  if (documentType === "page") return "page";
  if (documentType === "project") return "project";
  return null;
}

function runtimeTypeByEntityType(entityType: string): RuntimeHint {
  switch (entityType) {
    case "query":
    case "queries":
      return "query";
    case "component":
    case "components":
      return "component";
    case "component-table":
    case "component-dsl":
      return "component";
    case "view":
    case "views":
      return "view";
    case "action":
    case "actions":
      return "action";
    case "page":
    case "pages":
      return "page";
    case "project":
    case "projects":
      return "project";
    default:
      return null;
  }
}

function detectRuntimeHint(normalized: string): RuntimeHint {
  if (/\b(запрос|query)\b/.test(normalized)) return "query";
  if (/\b(таблиц|компонент|component|table)\b/.test(normalized))
    return "component";
  if (/\b(вид|view)\b/.test(normalized)) return "view";
  if (/\b(действи|action)\b/.test(normalized)) return "action";
  if (/\b(страниц|page)\b/.test(normalized)) return "page";
  if (/\b(проект|project)\b/.test(normalized)) return "project";
  return null;
}

function extractRuntimeName(text: string): string {
  const quoted = extractQuotedParts(text);
  if (quoted.length) return cleanTail(quoted[0] ?? "");
  const m = text.match(/(?:runtime|рантайм)(?:\s+для)?\s+(.+)$/i);
  if (!m?.[1]) return "";
  return cleanTail(m[1].replace(OPEN_DOC_PREFIX_RE, ""));
}

function tryMatchTableAction(text: string): LocalOrchestratorResult | null {
  if (ADD_COLUMN_RE.test(text)) {
    const title = extractColumnTitle(text) || "Новая колонка";
    return {
      request: { actions: [{ action: "table_add_column", title }] },
      summary: `Добавляю колонку "${title}".`,
    };
  }
  if (REMOVE_COLUMN_RE.test(text)) {
    if (isRemoveAllColumnsIntent(text)) {
      return {
        request: { actions: [{ action: "table_remove_column", all: true }] },
        summary: "Удаляю все колонки в текущей таблице.",
      };
    }
    const index = extractColumnIndex(text);
    if (index != null) {
      return {
        request: { actions: [{ action: "table_remove_column", index }] },
        summary: `Удаляю колонку #${index + 1}.`,
      };
    }
    const title = extractColumnTitle(text);
    if (!title) return null;
    return {
      request: { actions: [{ action: "table_remove_column", title }] },
      summary: `Удаляю колонку "${title}".`,
    };
  }
  if (CLEAR_DATAPATH_RE.test(text)) {
    return {
      request: { actions: [{ action: "table_clear_all_datapaths" }] },
      summary: "Очищаю все dataPath в текущей таблице.",
    };
  }
  if (AUTOFILL_DATAPATH_RE.test(text)) {
    return {
      request: { actions: [{ action: "table_auto_fill_datapaths" }] },
      summary: "Запускаю автоподстановку dataPath для текущей таблицы.",
    };
  }
  return null;
}

function tryMatchSingleton(text: string): LocalOrchestratorResult | null {
  if (!OPEN_VERB_RE.test(text)) return null;
  for (const alias of SINGLETON_ALIASES) {
    if (hasPattern(text, alias.patterns)) {
      return {
        request: {
          actions: [{ action: "open_singleton_tab", viewId: alias.viewId }],
        },
        summary: alias.summary,
      };
    }
  }
  return null;
}

function tryMatchWidget(text: string): LocalOrchestratorResult | null {
  if (!OPEN_VERB_RE.test(text)) return null;
  for (const alias of WIDGET_ALIASES) {
    if (hasPattern(text, alias.patterns)) {
      return {
        request: {
          actions: [{ action: "open_widget", widgetId: alias.widgetId }],
        },
        summary: alias.summary,
      };
    }
  }
  return null;
}

function tryMatchOpenDocument(
  text: string,
  entities: LocalOrchestratorEntity[],
): LocalOrchestratorResult | null {
  if (!OPEN_VERB_RE.test(text)) return null;
  const name = extractOpenName(text);
  if (!name) return null;

  const hint = detectDocumentHint(normalizeText(text));
  const ranked = rankEntities(entities, name, hint);
  if (!ranked.length) return null;
  if ((ranked[0]?.score ?? 0) < 56) return null;

  const topScore = ranked[0]?.score ?? 0;
  const close = ranked.filter((x) => x.score >= topScore - 8);
  if (close.length > 1) {
    return {
      request: { needs: [toDocChoiceNeed(name, close)] },
      summary: `Нашёл несколько документов для "${name}". Выберите нужный вариант.`,
    };
  }

  const winner = ranked[0]?.entity;
  if (!winner) return null;
  const label = `${DOCUMENT_TYPE_LABELS[winner.documentType] ?? winner.documentType}: ${winner.displayName || winner.identity}`;
  return {
    request: {
      actions: [
        {
          action: "open_document",
          documentType: winner.documentType,
          identity: winner.identity,
        },
      ],
    },
    summary: `Открываю ${label}.`,
  };
}

function tryMatchRuntime(
  text: string,
  entities: LocalOrchestratorEntity[],
  activeDocument?: LocalOrchestratorInput["activeDocument"],
): LocalOrchestratorResult | null {
  if (!RUNTIME_RE.test(text) || !COMMAND_VERB_RE.test(text)) return null;
  const hint = detectRuntimeHint(normalizeText(text));
  const name = extractRuntimeName(text);

  if (!name && activeDocument?.identity) {
    const activeType = runtimeTypeByDocumentType(
      String(activeDocument.documentType ?? ""),
    );
    if (!activeType) return null;
    return {
      request: {
        actions: [
          {
            action: "create_runtime",
            entityType: activeType,
            identity: String(activeDocument.identity),
          },
        ],
      },
      summary: `Запускаю runtime для ${String(activeDocument.identity)}.`,
    };
  }
  if (!name) return null;

  const ranked = rankEntities(
    entities,
    name,
    detectDocumentHint(normalizeText(text)),
  )
    .map((x) => {
      const runtimeType =
        runtimeTypeByEntityType(x.entity.entityType) ??
        runtimeTypeByDocumentType(x.entity.documentType);
      return { ...x, runtimeType };
    })
    .filter((x) => x.runtimeType != null)
    .filter((x) => hint == null || x.runtimeType === hint);

  if (!ranked.length) return null;
  if ((ranked[0]?.score ?? 0) < 56) return null;

  const topScore = ranked[0]?.score ?? 0;
  const close = ranked.filter((x) => x.score >= topScore - 8).slice(0, 4);
  if (close.length > 1) {
    return {
      request: {
        needs: [
          {
            id: "runtime-choice",
            description: `Нашёл несколько вариантов для runtime "${name}". Выберите, что запустить.`,
            choiceOptions: close.map((x) => ({
              entityType: x.runtimeType ?? "component",
              identity: x.entity.identity,
              label: `${DOCUMENT_TYPE_LABELS[x.entity.documentType] ?? x.entity.documentType}: ${x.entity.displayName || x.entity.identity}`,
            })),
          },
        ],
      },
      summary: `Нашёл несколько вариантов для runtime "${name}". Выберите нужный.`,
    };
  }

  const winner = close[0];
  if (!winner?.runtimeType) return null;
  return {
    request: {
      actions: [
        {
          action: "create_runtime",
          entityType: winner.runtimeType,
          identity: winner.entity.identity,
        },
      ],
    },
    summary: `Запускаю runtime для ${winner.entity.displayName || winner.entity.identity}.`,
  };
}

function tryMatchDuplicate(
  text: string,
  entities: LocalOrchestratorEntity[],
): LocalOrchestratorResult | null {
  if (!DUPLICATE_RE.test(text)) return null;
  const hint = detectDocumentHint(normalizeText(text));
  const { source, target } = extractDuplicateNames(text);
  if (!source) return null;

  const ranked = rankEntities(entities, source, hint).filter((x) =>
    DUPLICATE_SUPPORTED_DOCUMENT_TYPES.has(x.entity.documentType),
  );
  if (!ranked.length) return null;
  if ((ranked[0]?.score ?? 0) < 60) return null;
  if ((ranked[1]?.score ?? -100) >= (ranked[0]?.score ?? 0) - 6) return null;

  const winner = ranked[0]?.entity;
  if (!winner) return null;

  const nextName = cleanTail(target);
  let nextIdentity = makeIdentitySlug(nextName);
  if (nextIdentity && nextIdentity === winner.identity) {
    nextIdentity = `${nextIdentity}_copy`;
  }

  const action: FrontendAction = {
    action: "duplicate_document",
    documentType: winner.documentType,
    identity: winner.identity,
    ...(nextIdentity ? { newIdentity: nextIdentity } : {}),
    ...(nextName ? { newName: nextName } : {}),
  };

  return {
    request: { actions: [action] },
    summary: `Создаю копию: ${winner.displayName || winner.identity}.`,
  };
}

export function runLocalAgentOrchestrator(
  input: LocalOrchestratorInput,
): LocalOrchestratorResult | null {
  const text = String(input.message ?? "").trim();
  if (!text) return null;
  if (isLikelyQuestion(text)) return null;
  if (!COMMAND_VERB_RE.test(text)) return null;
  if (text.length > 280) return null;

  const table = tryMatchTableAction(text);
  if (table) return table;

  const singleton = tryMatchSingleton(text);
  if (singleton) return singleton;

  const widget = tryMatchWidget(text);
  if (widget) return widget;

  const duplicate = tryMatchDuplicate(text, input.entities);
  if (duplicate) return duplicate;

  const runtime = tryMatchRuntime(text, input.entities, input.activeDocument);
  if (runtime) return runtime;

  const openDocument = tryMatchOpenDocument(text, input.entities);
  if (openDocument) return openDocument;

  return null;
}
