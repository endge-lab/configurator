/**
 * Протокол frontend-request: парсинг блока из ответа LLM и выполнение действий (открыть виджет, документ, вкладку; действия над таблицей).
 * См. egorkozelskij-endge-assistance-service/docs/ASSISTANCE_PROTOCOL.md
 */

import { showWidget } from "@/components/layouts/grid";
import type { DomainDocumentType } from "@endge/core";
import { DomainSectionType, Endge } from "@endge/core";
import { EndgeIDE } from "@/features/endge-ide/model/core/endge-ide.ts";
import { runAgentTableAction } from "@/features/endge-ide/model/agent/agent-table-actions";
import { setPulseActiveTab } from "@/features/endge-ide/model/pulse/pulse.mock.ts";
import { launchPulseRuntimeFromEntity } from "@/features/endge-ide/model/pulse/pulse.mock.ts";
import {
  duplicateEntity,
  getEntityByDocType,
} from "@/features/endge-ide/model/domain/domain-duplicate";
import { toast } from "vue-sonner";

/** Вариант выбора для неоднозначного запроса (например, «создай runtime расписание» — и запрос, и таблица). */
export interface FrontendNeedChoiceOption {
  entityType: string;
  identity: string;
  label?: string;
}

/** Вариант выбора при неоднозначном открытии документа («открой расписание» — вид или таблица). */
export interface FrontendNeedOpenDocumentOption {
  documentType: string;
  identity: string;
  label?: string;
}

export interface FrontendNeed {
  id: string;
  description: string;
  entityType?: string;
  identities?: string[];
  /** Варианты на выбор: по клику запускается create_runtime для выбранного варианта. */
  choiceOptions?: FrontendNeedChoiceOption[];
  /** Варианты открытия документа: по клику открывается документ (documentType + identity). */
  openDocumentChoiceOptions?: FrontendNeedOpenDocumentOption[];
}

export type FrontendAction =
  | { action: "open_widget"; widgetId: string }
  | {
      action: "open_document";
      documentType: string;
      identity: string;
      inNewTab?: boolean;
    }
  | {
      action: "duplicate_document";
      documentType: string;
      identity: string;
      newIdentity?: string;
      newName?: string;
    }
  | { action: "open_singleton_tab"; viewId: string }
  | { action: "table_auto_fill_datapaths" }
  | { action: "table_clear_all_datapaths" }
  | { action: "table_add_column"; title: string }
  | {
      action: "table_remove_column";
      title?: string;
      index?: number;
      all?: boolean;
    }
  | {
      action: "create_runtime";
      entityType: string;
      identity: string;
      basePath?: string;
    };

export interface FrontendRequest {
  analysisSnapshot?: string;
  needs?: FrontendNeed[];
  actions?: FrontendAction[];
}

const FRONTEND_REQUEST_BLOCK_REG = /```frontend-request\s*([\s\S]*?)```/;

const FRONTEND_ACTION_ALIASES: Record<string, FrontendAction["action"]> = {
  open_widget: "open_widget",
  openwidget: "open_widget",
  show_widget: "open_widget",
  open_document: "open_document",
  opendocument: "open_document",
  show_document: "open_document",
  duplicate_document: "duplicate_document",
  duplicatedocument: "duplicate_document",
  copy_document: "duplicate_document",
  open_singleton_tab: "open_singleton_tab",
  opensingletontab: "open_singleton_tab",
  open_singleton: "open_singleton_tab",
  open_tab: "open_singleton_tab",
  table_auto_fill_datapaths: "table_auto_fill_datapaths",
  table_autofill_datapaths: "table_auto_fill_datapaths",
  auto_fill_datapaths: "table_auto_fill_datapaths",
  autofill_datapaths: "table_auto_fill_datapaths",
  table_clear_all_datapaths: "table_clear_all_datapaths",
  table_clear_datapaths: "table_clear_all_datapaths",
  clear_all_datapaths: "table_clear_all_datapaths",
  clear_datapaths: "table_clear_all_datapaths",
  table_add_column: "table_add_column",
  table_add_col: "table_add_column",
  add_column: "table_add_column",
  table_remove_column: "table_remove_column",
  table_remove_col: "table_remove_column",
  remove_column: "table_remove_column",
  delete_column: "table_remove_column",
  create_runtime: "create_runtime",
  createruntime: "create_runtime",
  run_runtime: "create_runtime",
  start_runtime: "create_runtime",
};

const DOCUMENT_TYPE_ALIASES: Record<string, string> = {
  "component-table": "component-table",
  component_table: "component-table",
  componenttable: "component-table",
  table: "component-table",
  tables: "component-table",
  component: "component-table",
  "component-dsl": "component-dsl",
  component_dsl: "component-dsl",
  componentdsl: "component-dsl",
  dsl: "component-dsl",
  "query-gql": "query-gql",
  query_gql: "query-gql",
  gql: "query-gql",
  graphql: "query-gql",
  query: "query-gql",
  queries: "query-gql",
  "query-rest": "query-rest",
  query_rest: "query-rest",
  rest: "query-rest",
  "query-custom": "query-custom",
  query_custom: "query-custom",
  custom_query: "query-custom",
  custom: "query-custom",
  type: "type",
  types: "type",
  primitive: "primitive",
  action: "action",
  actions: "action",
  "default-parameter": "default-parameter",
  default_parameter: "default-parameter",
  parameter: "default-parameter",
  parameters: "default-parameter",
  "default-filter": "default-filter",
  default_filter: "default-filter",
  filter: "default-filter",
  filters: "default-filter",
  converter: "converter",
  converters: "converter",
  integration: "integration",
  integrations: "integration",
  environment: "environment",
  environments: "environment",
  tenant: "tenant",
  tenants: "tenant",
  policy: "policy",
  policies: "policy",
  style: "style",
  styles: "style",
  vocabs: "vocabs",
  vocab: "vocabs",
  "auth-profile": "auth-profile",
  auth_profile: "auth-profile",
  authprofile: "auth-profile",
  auth: "auth-profile",
  authentication: "auth-profile",
  "i18n-bundles": "i18n-bundles",
  i18n_bundles: "i18n-bundles",
  i18n: "i18n-bundles",
  page: "page",
  pages: "page",
  "page-template": "page-template",
  page_template: "page-template",
  pagetemplate: "page-template",
  navigation: "navigation",
  navigations: "navigation",
  project: "project",
  projects: "project",
};

const NEED_ENTITY_TYPE_ALIASES: Record<string, string> = {
  project: "projects",
  projects: "projects",
  folder: "folders",
  folders: "folders",
  type: "types",
  types: "types",
  primitive: "types",
  primitives: "types",
  query: "queries",
  queries: "queries",
  "query-gql": "queries",
  "query-rest": "queries",
  "query-custom": "queries",
  component: "components",
  components: "components",
  "component-table": "components",
  "component-dsl": "components",
  table: "components",
  tables: "components",
  filter: "filters",
  filters: "filters",
  action: "actions",
  actions: "actions",
  parameter: "parameters",
  parameters: "parameters",
  "default-parameter": "parameters",
  converter: "converters",
  converters: "converters",
  integration: "integrations",
  integrations: "integrations",
  environment: "environments",
  environments: "environments",
  tenant: "tenants",
  tenants: "tenants",
  policy: "policies",
  policies: "policies",
  style: "styles",
  styles: "styles",
  vocab: "vocabs",
  vocabs: "vocabs",
  auth: "auth-profiles",
  "auth-profile": "auth-profiles",
  "auth-profiles": "auth-profiles",
  navigation: "navigations",
  navigations: "navigations",
  page: "pages",
  pages: "pages",
  "page-template": "page-templates",
  "page-templates": "page-templates",
  i18n: "i18n-bundles",
  "i18n-bundle": "i18n-bundles",
  "i18n-bundles": "i18n-bundles",
};

const DOMAIN_SLICE_KEY_SET = new Set<string>([
  "projects",
  "types",
  "queries",
  "components",
  "folders",
  "filters",
  "actions",
  "integrations",
  "environments",
  "tenants",
  "policies",
  "styles",
  "parameters",
  "converters",
  "vocabs",
  "navigations",
  "page-templates",
  "pages",
  "i18n-bundles",
  "auth-profiles",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value))
    return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function readStringFrom(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = readString(obj[key]);
    if (value) return value;
  }
  return "";
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
}

function readInteger(value: unknown): number | undefined {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isInteger(num)) return undefined;
  return num;
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => readString(item))
      .filter((item) => item.length > 0);
  }
  const single = readString(value);
  if (!single) return [];
  if (single.includes(",")) {
    return single
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [single];
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeActionName(raw: unknown): FrontendAction["action"] | null {
  const token = normalizeToken(String(raw ?? ""));
  if (!token) return null;
  return FRONTEND_ACTION_ALIASES[token] ?? null;
}

function normalizeDocumentType(raw: unknown): string {
  const value = readString(raw);
  if (!value) return "";
  const token = normalizeToken(value);
  if (DOCUMENT_TYPE_ALIASES[token]) return DOCUMENT_TYPE_ALIASES[token];
  const kebab = token.replace(/_/g, "-");
  if (ALLOWED_DOCUMENT_TYPES.has(kebab)) return kebab;
  return value;
}

export function normalizeNeedEntityTypeToSliceKey(
  raw: string | null | undefined,
): string | undefined {
  const value = readString(raw ?? "");
  if (!value) return undefined;
  const token = normalizeToken(value);
  const kebab = token.replace(/_/g, "-");
  const mapped = NEED_ENTITY_TYPE_ALIASES[token] ?? NEED_ENTITY_TYPE_ALIASES[kebab];
  if (mapped) return mapped;
  if (DOMAIN_SLICE_KEY_SET.has(kebab)) return kebab;
  return undefined;
}

function normalizeNeedChoiceOption(
  raw: unknown,
): FrontendNeedChoiceOption | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const identity = readStringFrom(rec, ["identity", "documentId", "id"]);
  if (!identity) return null;
  const rawType = readStringFrom(rec, ["entityType", "entity_type", "type"]);
  const normalizedType =
    normalizeRuntimeEntityType(rawType) ??
    (rawType ? normalizeRuntimeEntityType(normalizeDocumentType(rawType)) : null);
  if (!normalizedType) return null;
  const label = readString(rec.label);
  return {
    entityType: normalizedType,
    identity,
    label: label || undefined,
  };
}

function normalizeNeedOpenDocumentChoiceOption(
  raw: unknown,
): FrontendNeedOpenDocumentOption | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const identity = readStringFrom(rec, ["identity", "documentId", "id"]);
  if (!identity) return null;
  const documentType = normalizeDocumentType(
    readStringFrom(rec, ["documentType", "document_type", "type"]),
  );
  if (!documentType) return null;
  const label = readString(rec.label);
  return {
    documentType,
    identity,
    label: label || undefined,
  };
}

function normalizeFrontendNeed(raw: unknown, index: number): FrontendNeed | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const id = readString(rec.id) || `need-${index + 1}`;
  const description =
    readStringFrom(rec, ["description", "text", "message"]) ||
    "Требуется дополнительный контекст.";
  const entityType = normalizeNeedEntityTypeToSliceKey(
    readStringFrom(rec, ["entityType", "entity_type", "type"]),
  );
  const identities = readStringArray(
    rec.identities ?? rec.identity ?? rec.ids ?? rec.entityIds,
  );

  const choiceSource = Array.isArray(rec.choiceOptions)
    ? rec.choiceOptions
    : Array.isArray(rec.choice_options)
      ? rec.choice_options
      : Array.isArray(rec.choices)
        ? rec.choices
        : Array.isArray(rec.options)
          ? rec.options
          : [];
  const choiceOptions = choiceSource
    .map((item) => normalizeNeedChoiceOption(item))
    .filter(Boolean) as FrontendNeedChoiceOption[];

  const openChoiceSource = Array.isArray(rec.openDocumentChoiceOptions)
    ? rec.openDocumentChoiceOptions
    : Array.isArray(rec.open_document_choice_options)
      ? rec.open_document_choice_options
      : Array.isArray(rec.openDocumentOptions)
        ? rec.openDocumentOptions
        : Array.isArray(rec.documentOptions)
          ? rec.documentOptions
          : [];
  let openDocumentChoiceOptions = openChoiceSource
    .map((item) => normalizeNeedOpenDocumentChoiceOption(item))
    .filter(Boolean) as FrontendNeedOpenDocumentOption[];
  if (!openDocumentChoiceOptions.length && choiceSource.length) {
    openDocumentChoiceOptions = choiceSource
      .map((item) => normalizeNeedOpenDocumentChoiceOption(item))
      .filter(Boolean) as FrontendNeedOpenDocumentOption[];
  }

  const out: FrontendNeed = { id, description };
  if (entityType) out.entityType = entityType;
  if (identities.length) out.identities = identities;
  if (choiceOptions.length) out.choiceOptions = choiceOptions;
  if (openDocumentChoiceOptions.length)
    out.openDocumentChoiceOptions = openDocumentChoiceOptions;
  return out;
}

function normalizeFrontendAction(raw: unknown): FrontendAction | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const action = normalizeActionName(
    rec.action ?? rec.type ?? rec.kind ?? rec.name,
  );
  if (!action) return null;

  if (action === "open_widget") {
    const widgetId = readStringFrom(rec, ["widgetId", "widget_id", "widget"]);
    if (!widgetId) return null;
    return { action, widgetId };
  }
  if (action === "open_document") {
    const documentType = normalizeDocumentType(
      rec.documentType ?? rec.document_type ?? rec.type,
    );
    const identity = readStringFrom(rec, ["identity", "documentId", "id"]);
    const inNewTab = readBoolean(rec.inNewTab ?? rec.in_new_tab);
    if (!documentType || !identity) return null;
    return {
      action,
      documentType,
      identity,
      inNewTab,
    };
  }
  if (action === "duplicate_document") {
    const documentType = normalizeDocumentType(
      rec.documentType ?? rec.document_type ?? rec.type,
    );
    const identity = readStringFrom(rec, ["identity", "documentId", "id"]);
    const newIdentity = readStringFrom(rec, ["newIdentity", "new_identity"]);
    const newName = readStringFrom(rec, ["newName", "new_name", "name"]);
    if (!documentType || !identity) return null;
    return {
      action,
      documentType,
      identity,
      newIdentity: newIdentity || undefined,
      newName: newName || undefined,
    };
  }
  if (action === "open_singleton_tab") {
    const viewId = readStringFrom(rec, ["viewId", "view_id", "tabId", "tab_id"]);
    if (!viewId) return null;
    return { action, viewId };
  }
  if (action === "table_auto_fill_datapaths") {
    return { action };
  }
  if (action === "table_clear_all_datapaths") {
    return { action };
  }
  if (action === "table_add_column") {
    const title = readStringFrom(rec, ["title", "columnTitle", "column", "name"]);
    if (!title) return null;
    return { action, title };
  }
  if (action === "table_remove_column") {
    const title = readStringFrom(rec, ["title", "columnTitle", "column", "name"]);
    const index = readInteger(
      rec.index ?? rec.columnIndex ?? rec.column_index ?? rec.position,
    );
    const all = readBoolean(rec.all ?? rec.removeAll ?? rec.remove_all);
    return {
      action,
      title: title || undefined,
      index,
      all,
    };
  }
  if (action === "create_runtime") {
    const entityType = readStringFrom(rec, ["entityType", "entity_type", "type"]);
    const identity = readStringFrom(rec, ["identity", "documentId", "id"]);
    const basePath = readStringFrom(rec, ["basePath", "base_path"]);
    return {
      action,
      entityType,
      identity,
      basePath: basePath || undefined,
    };
  }
  return null;
}

export function normalizeFrontendRequest(raw: unknown): FrontendRequest | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const actionsRaw = Array.isArray(rec.actions) ? rec.actions : [];
  const needsRaw = Array.isArray(rec.needs) ? rec.needs : [];
  const actions = actionsRaw
    .map((item) => normalizeFrontendAction(item))
    .filter(Boolean) as FrontendAction[];
  const needs = needsRaw
    .map((item, idx) => normalizeFrontendNeed(item, idx))
    .filter(Boolean) as FrontendNeed[];
  const analysisSnapshot = readString(
    rec.analysisSnapshot ?? rec.analysis_snapshot,
  );
  if (!actions.length && !needs.length && !analysisSnapshot) return null;
  const out: FrontendRequest = {};
  if (analysisSnapshot) out.analysisSnapshot = analysisSnapshot;
  if (actions.length) out.actions = actions;
  if (needs.length) out.needs = needs;
  return out;
}

/** Ответ итеративного режима (одна LLM): userAction, isFinal, summary. */
export interface IterateResponse {
  userAction?: Array<{ action: string; payload?: Record<string, unknown> }>;
  isFinal?: boolean;
  summary?: string;
}

/** Преобразует userAction из итеративного ответа в FrontendRequest.actions для applyFrontendRequest. request_entities не выполняются фронтом — только накапливаются для контекста. */
export function iterateUserActionToFrontendRequest(
  userAction: IterateResponse["userAction"],
): FrontendRequest | null {
  if (!userAction?.length) return null;
  const actions = userAction
    .filter((item) => item.action !== "request_entities")
    .map((item) => {
      const payload = item.payload ?? {};
      return { action: item.action, ...payload };
    });
  if (!actions.length) return null;
  return normalizeFrontendRequest({ actions });
}

/** Payload для request_entities: запрос сущностей по имени/типу для следующего контекста. */
export interface RequestEntitiesPayload {
  name?: string;
  documentType?: string;
  entityType?: string;
}

/** Извлекает из userAction все request_entities и возвращает последний payload (для накопления контекста на фронте). */
export function getRequestEntitiesFilter(
  userAction: IterateResponse["userAction"],
): RequestEntitiesPayload | null {
  if (!userAction?.length) return null;
  const last = [...userAction]
    .reverse()
    .find((item) => item.action === "request_entities");
  if (!last?.payload) return null;
  const p = last.payload;
  return {
    name: typeof p.name === "string" ? p.name : undefined,
    documentType:
      typeof p.documentType === "string"
        ? normalizeDocumentType(p.documentType)
        : undefined,
    entityType:
      typeof p.entityType === "string"
        ? normalizeNeedEntityTypeToSliceKey(p.entityType)
        : undefined,
  };
}

/** Допустимые widgetId (см. config/widgets.ts). */
const ALLOWED_WIDGET_IDS = new Set([
  "project",
  "versions",
  "errors",
  "storage",
  "testing",
  "events",
  "runtime-debug",
  "pulse",
  "raph",
  "help",
  "agent",
]);

/** documentType для openDocument. */
const ALLOWED_DOCUMENT_TYPES = new Set([
  "query-gql",
  "query-rest",
  "query-custom",
  "component-dsl",
  "component-table",
  "type",
  "primitive",
  "action",
  "default-parameter",
  "default-filter",
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
  "project",
]);

/** documentType для duplicate_document (поддерживается в model/domain/domain-duplicate.ts). */
const DUPLICATE_ALLOWED_DOCUMENT_TYPES = new Set([
  "query-gql",
  "query-rest",
  "query-custom",
  "component-dsl",
  "component-table",
  "action",
  "default-parameter",
  "default-filter",
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
]);

type RuntimeEntityType =
  | "component"
  | "query"
  | "action"
  | "page"
  | "project";

/** Нормализованное entityType (из create_runtime) → DomainSectionType. */
const CREATE_RUNTIME_SECTION_TYPES: Record<
  RuntimeEntityType,
  DomainSectionType
> = {
  component: DomainSectionType.Component,
  query: DomainSectionType.Query,
  action: DomainSectionType.Action,
  page: DomainSectionType.Page,
  project: DomainSectionType.Project,
};

/** Алиасы entityType из модели/оркестратора/промптов. */
const RUNTIME_ENTITY_TYPE_ALIASES: Record<string, RuntimeEntityType> = {
  component: "component",
  components: "component",
  "component-table": "component",
  "component-dsl": "component",
  table: "component",
  tables: "component",
  query: "query",
  queries: "query",
  "query-gql": "query",
  "query-rest": "query",
  "query-custom": "query",
  action: "action",
  actions: "action",
  page: "page",
  pages: "page",
  project: "project",
  projects: "project",
};

function normalizeRuntimeEntityType(raw: string): RuntimeEntityType | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return RUNTIME_ENTITY_TYPE_ALIASES[key] ?? null;
}

function hasIdentity(list: unknown[], identity: string): boolean {
  const want = identity.trim().toLowerCase();
  if (!want) return false;
  return list.some((e) => {
    const rec = e as { identity?: unknown; id?: unknown };
    const v = String(rec.identity ?? rec.id ?? "")
      .trim()
      .toLowerCase();
    return v === want;
  });
}

/** Если entityType невалиден, пробуем вывести тип по identity из домена. */
function inferRuntimeEntityTypeByIdentity(
  identity: string,
): RuntimeEntityType | null {
  const id = identity.trim();
  if (!id) return null;
  const matches = new Set<RuntimeEntityType>();
  if (hasIdentity(Endge.domain.getComponents() as unknown[], id))
    matches.add("component");
  if (hasIdentity(Endge.domain.getQueries() as unknown[], id))
    matches.add("query");
  if (hasIdentity(Endge.domain.getActions() as unknown[], id))
    matches.add("action");
  if (hasIdentity(Endge.domain.getPages() as unknown[], id))
    matches.add("page");
  if (hasIdentity(Endge.domain.getProjects() as unknown[], id))
    matches.add("project");
  if (matches.size !== 1) return null;
  return [...matches][0] ?? null;
}

function runtimeTypeByDocumentType(
  documentTypeRaw: string,
): RuntimeEntityType | null {
  const doc = documentTypeRaw.trim().toLowerCase();
  if (!doc) return null;
  if (doc.startsWith("component-")) return "component";
  if (doc.startsWith("query-")) return "query";
  if (doc === "action") return "action";
  if (doc === "page") return "page";
  if (doc === "project") return "project";
  return null;
}

/**
 * fallback identity: если модель не передала identity для create_runtime,
 * берём identity активного документа (если тип совместим).
 */
function resolveRuntimeIdentityFromActiveTab(
  preferredType: RuntimeEntityType | null,
): { identity: string; inferredType: RuntimeEntityType | null } {
  const activeTab = EndgeIDE.tabs.activeTab.value as {
    payload?: {
      documentType?: unknown;
      documentId?: unknown;
      identity?: unknown;
    };
  } | null;
  const payload = activeTab?.payload;
  const identity = String(
    payload?.identity ?? payload?.documentId ?? "",
  ).trim();
  if (!identity) return { identity: "", inferredType: preferredType };

  const activeType = runtimeTypeByDocumentType(
    String(payload?.documentType ?? ""),
  );
  if (preferredType && activeType && preferredType !== activeType) {
    return { identity: "", inferredType: preferredType };
  }
  return { identity, inferredType: preferredType ?? activeType };
}

/** Запускает runtime для сущности и открывает вкладку Пульс. Для component без basePath подставляется "default". */
export function executeCreateRuntime(
  entityType: string,
  identity: string,
  basePath?: string,
): { ok: boolean; message: string } {
  const preferredType = normalizeRuntimeEntityType(entityType);
  let id = identity.trim();
  let resolvedType = preferredType;
  if (!id) {
    const fallback = resolveRuntimeIdentityFromActiveTab(preferredType);
    id = fallback.identity;
    resolvedType = fallback.inferredType;
  }
  if (!id) {
    return {
      ok: false,
      message:
        "Укажите identity сущности или откройте нужный документ перед запуском runtime.",
    };
  }

  const normalizedType = resolvedType ?? inferRuntimeEntityTypeByIdentity(id);
  const sectionType = normalizedType
    ? CREATE_RUNTIME_SECTION_TYPES[normalizedType]
    : undefined;
  if (!sectionType) {
    return {
      ok: false,
      message: `Не удалось определить entityType для runtime: "${entityType}". Допустимы: component, query, action, page, project.`,
    };
  }

  const opts: { basePath?: string } = {};
  if (sectionType === DomainSectionType.Component && basePath === undefined)
    opts.basePath = "default";
  else if (basePath !== undefined) opts.basePath = basePath;

  const res = launchPulseRuntimeFromEntity({ id, sectionType }, opts);
  if (!res.ok) {
    return { ok: false, message: res.message };
  }
  EndgeIDE.tabs.openPulseTab();
  showWidget("pulse");
  return { ok: true, message: res.message ?? "Runtime запущен." };
}

/** Открывает документ по выбору пользователя (из openDocumentChoiceOptions в чате). */
export function executeOpenDocumentChoice(
  option: FrontendNeedOpenDocumentOption,
): { ok: boolean; message: string } {
  const documentType = String(option.documentType ?? "").trim();
  const identity = String(option.identity ?? "").trim();
  if (!ALLOWED_DOCUMENT_TYPES.has(documentType)) {
    return {
      ok: false,
      message: `Недопустимый documentType: "${documentType}".`,
    };
  }
  if (!identity) return { ok: false, message: "Укажите identity." };
  try {
    EndgeIDE.tabs.openDocument(
      identity,
      documentType as DomainDocumentType,
    );
    return { ok: true, message: "" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

function buildDuplicateIdentity(base: string): string {
  const trimmed = base.trim().toLowerCase();
  const slug = trimmed
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9а-я_-]+/gi, "")
    .replace(/^_+|_+$/g, "");
  if (!slug) return "";
  return /^\d/.test(slug) ? `copy_${slug}` : slug;
}

function findAvailableDuplicateIdentity(
  documentType: DomainDocumentType,
  sourceIdentity: string,
  preferred?: string,
): string {
  const base =
    buildDuplicateIdentity(preferred ?? "") ||
    buildDuplicateIdentity(`${sourceIdentity}_copy`) ||
    `${sourceIdentity}_copy`;
  let candidate = base;
  let i = 2;
  while (getEntityByDocType(Endge.domain, candidate, documentType) != null) {
    candidate = `${base}_${i}`;
    i++;
    if (i > 1000) break;
  }
  return candidate;
}

function readEntityName(
  documentType: DomainDocumentType,
  identity: string,
): string {
  const source = getEntityByDocType(Endge.domain, identity, documentType) as {
    name?: string;
    identity?: string;
  } | null;
  return String(source?.name ?? source?.identity ?? identity);
}

/** Дублирует документ домена (component/query/action/...) и сохраняет копию. */
export async function executeDuplicateDocument(
  documentTypeRaw: string,
  sourceIdentityRaw: string,
  newIdentityRaw?: string,
  newNameRaw?: string,
): Promise<{ ok: boolean; message: string; newIdentity?: string }> {
  const documentType = String(documentTypeRaw ?? "").trim();
  const sourceIdentity = String(sourceIdentityRaw ?? "").trim();
  if (!DUPLICATE_ALLOWED_DOCUMENT_TYPES.has(documentType)) {
    return {
      ok: false,
      message: `duplicate_document: недопустимый documentType "${documentType}"`,
    };
  }
  if (!sourceIdentity) {
    return {
      ok: false,
      message: "duplicate_document: нужен identity исходного документа",
    };
  }

  const docType = documentType as DomainDocumentType;
  const source = getEntityByDocType(Endge.domain, sourceIdentity, docType);
  if (!source) {
    return {
      ok: false,
      message: `duplicate_document: источник не найден (${documentType}/${sourceIdentity})`,
    };
  }

  const requestedIdentity = buildDuplicateIdentity(
    String(newIdentityRaw ?? ""),
  );
  const nextIdentity = findAvailableDuplicateIdentity(
    docType,
    sourceIdentity,
    requestedIdentity,
  );
  const nextName =
    String(newNameRaw ?? "").trim() ||
    `${readEntityName(docType, sourceIdentity)} Copy`;

  try {
    await duplicateEntity(sourceIdentity, docType, nextIdentity, nextName);
    return {
      ok: true,
      message: `Создана копия: ${nextIdentity}`,
      newIdentity: nextIdentity,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** viewId → метод открытия синглтон-вкладки. */
const SINGLETON_VIEW_METHODS: Record<string, () => void> = {
  "dsl-playground": () => EndgeIDE.tabs.openDSLPlayground(),
  "sfc-playground": () => EndgeIDE.tabs.openSFCPlayground(),
  "action-playgrounds": () => EndgeIDE.tabs.openActionPlaygroundsSingleton(),
  "backup-restore": () => EndgeIDE.tabs.openBackupRestoreSingleton(),
  demonstration: () => EndgeIDE.tabs.openDemonstrationTab(),
  pulse: () => EndgeIDE.tabs.openPulseTab(),
  diagnostics: () => {
    setPulseActiveTab("diagnostics");
    EndgeIDE.tabs.openPulseTab();
  },
  "domain-analysis": () => EndgeIDE.tabs.openDomainAnalysis(),
  architecture: () => EndgeIDE.tabs.openArchitecture(),
};

function getActiveTableColumnTitles(): string[] {
  const ed = EndgeIDE.tabs.documentEditorModel.value as {
    columns?: Array<{ title?: unknown }>;
  } | null;
  if (!Array.isArray(ed?.columns)) return [];
  return ed.columns.map((col) => String(col?.title ?? "").trim());
}

function normalizeTextToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-я]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAllColumnsToken(raw: string): boolean {
  const token = normalizeTextToken(raw);
  if (!token) return false;
  if (
    token === "all" ||
    token === "all columns" ||
    token === "все" ||
    token === "все колонки" ||
    token === "все столбцы"
  )
    return true;
  return (
    /\b(all|все)\b/.test(token) &&
    /\b(column|columns|колонк|столбц)\b/.test(token)
  );
}

function resolveColumnIndexByTitle(
  title: string,
  titles: string[],
): number | null {
  const want = normalizeTextToken(title);
  if (!want) return null;

  const exact = titles.findIndex((t) => normalizeTextToken(t) === want);
  if (exact >= 0) return exact;

  const includes = titles.findIndex((t) =>
    normalizeTextToken(t).includes(want),
  );
  if (includes >= 0) return includes;

  return null;
}

/**
 * Извлекает из текста ответа агента блок frontend-request.
 */
export function parseFrontendRequestFromMessage(
  text: string,
): FrontendRequest | null {
  if (!text?.trim()) return null;
  const m = text.match(FRONTEND_REQUEST_BLOCK_REG);
  if (!m) return null;
  try {
    const raw = (m[1] ?? "").trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return normalizeFrontendRequest(parsed);
  } catch {
    return null;
  }
}

export interface ApplyFrontendRequestResult {
  actionsExecuted: number;
  errors: string[];
}

/**
 * Выполняет действия из frontend-request: open_widget, open_document, open_singleton_tab, действия над таблицей.
 */
export async function applyFrontendRequest(
  req: FrontendRequest,
): Promise<ApplyFrontendRequestResult> {
  const errors: string[] = [];
  let actionsExecuted = 0;
  const tabs = EndgeIDE.tabs;

  for (const act of req.actions ?? []) {
    if (act.action === "open_widget") {
      const widgetId = String(act.widgetId ?? "").trim();
      if (!ALLOWED_WIDGET_IDS.has(widgetId)) {
        errors.push(`open_widget: недопустимый widgetId "${widgetId}"`);
        continue;
      }
      try {
        showWidget(widgetId);
        actionsExecuted++;
      } catch (e) {
        errors.push(
          `open_widget ${widgetId}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      continue;
    }

    if (act.action === "open_document") {
      const documentType = normalizeDocumentType(act.documentType);
      const identity = String(act.identity ?? "").trim();
      if (!ALLOWED_DOCUMENT_TYPES.has(documentType)) {
        errors.push(
          `open_document: недопустимый documentType "${documentType}"`,
        );
        continue;
      }
      if (!identity) {
        errors.push("open_document: нужен identity");
        continue;
      }
      try {
        tabs.openDocument(identity, documentType as DomainDocumentType);
        actionsExecuted++;
      } catch (e) {
        errors.push(
          `open_document ${documentType}/${identity}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      continue;
    }

    if (act.action === "duplicate_document") {
      const documentType = normalizeDocumentType(act.documentType);
      const identity = String(act.identity ?? "").trim();
      const newIdentity = String(act.newIdentity ?? "").trim() || undefined;
      const newName = String(act.newName ?? "").trim() || undefined;
      const res = await executeDuplicateDocument(
        documentType,
        identity,
        newIdentity,
        newName,
      );
      if (res.ok) {
        actionsExecuted++;
        toast.success("Документ скопирован", {
          description: res.newIdentity ?? res.message,
        });
      } else {
        errors.push(res.message);
      }
      continue;
    }

    if (act.action === "open_singleton_tab") {
      const viewId = String(act.viewId ?? "").trim();
      const fn = SINGLETON_VIEW_METHODS[viewId];
      if (!fn) {
        errors.push(`open_singleton_tab: недопустимый viewId "${viewId}"`);
        continue;
      }
      try {
        fn();
        actionsExecuted++;
      } catch (e) {
        errors.push(
          `open_singleton_tab ${viewId}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      continue;
    }

    if (act.action === "table_auto_fill_datapaths") {
      try {
        const ok = await runAgentTableAction("auto_fill_datapaths");
        if (ok) actionsExecuted++;
      } catch (e) {
        errors.push(
          `table_auto_fill_datapaths: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      continue;
    }

    if (act.action === "table_clear_all_datapaths") {
      try {
        const ok = await runAgentTableAction("clear_all_datapaths");
        if (ok) actionsExecuted++;
      } catch (e) {
        errors.push(
          `table_clear_all_datapaths: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      continue;
    }

    if (act.action === "table_add_column") {
      const title = String(act.title ?? "").trim();
      try {
        const ok = await runAgentTableAction("add_column", { title });
        if (ok) actionsExecuted++;
      } catch (e) {
        errors.push(
          `table_add_column: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      continue;
    }

    if (act.action === "table_remove_column") {
      const payload = act as {
        title?: unknown;
        index?: unknown;
        all?: unknown;
      };
      const title = String(payload.title ?? "").trim();
      const indexAsNumber =
        typeof payload.index === "string"
          ? Number(payload.index)
          : payload.index;
      const directIndex =
        typeof indexAsNumber === "number" && Number.isInteger(indexAsNumber)
          ? indexAsNumber
          : null;
      const all = payload.all === true || isAllColumnsToken(title);
      const titles = getActiveTableColumnTitles();

      if (all) {
        if (!titles.length) {
          errors.push(
            "table_remove_column: в текущей таблице нет колонок для удаления",
          );
          continue;
        }
        let removed = 0;
        try {
          for (let i = titles.length - 1; i >= 0; i--) {
            const ok = await runAgentTableAction("remove_column", { index: i });
            if (ok) removed++;
          }
          if (removed > 0) actionsExecuted += removed;
          else
            errors.push(
              "table_remove_column: обработчик удаления колонок недоступен",
            );
        } catch (e) {
          errors.push(
            `table_remove_column(all): ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        continue;
      }

      let index = directIndex;
      if (index == null && title) {
        index = resolveColumnIndexByTitle(title, titles);
      }
      if (index == null) {
        errors.push(
          "table_remove_column: укажите index или title существующей колонки",
        );
        continue;
      }
      if (index < 0 || index >= titles.length) {
        errors.push(
          `table_remove_column: индекс колонки вне диапазона (${index}), всего колонок: ${titles.length}`,
        );
        continue;
      }
      try {
        const ok = await runAgentTableAction("remove_column", { index });
        if (ok) actionsExecuted++;
        else
          errors.push(
            "table_remove_column: обработчик удаления колонок недоступен",
          );
      } catch (e) {
        errors.push(
          `table_remove_column: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      continue;
    }

    if (act.action === "create_runtime") {
      const entityType = String(act.entityType ?? "").trim();
      const identity = String(act.identity ?? "").trim();
      const basePath = (act.basePath ?? "").trim() || undefined;
      try {
        const res = executeCreateRuntime(entityType, identity, basePath);
        if (res.ok) {
          actionsExecuted++;
          toast.success("Runtime запущен", { description: res.message });
        } else {
          errors.push(`create_runtime: ${res.message}`);
        }
      } catch (e) {
        errors.push(
          `create_runtime: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      continue;
    }

    const unknownAction = String((act as { action?: unknown }).action ?? "").trim();
    errors.push(`Неподдерживаемое действие frontend-request: "${unknownAction}"`);
  }

  return { actionsExecuted, errors };
}
