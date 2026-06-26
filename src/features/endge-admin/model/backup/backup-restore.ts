import type { DomainDocumentType, EndgeDomain } from '@endge/core'

import {
  ComponentType,
  Endge,
  EndgeDomain as EndgeDomainClass,
  FilterType,
  ParameterType,
  QueryType,
  ScriptType,
} from '@endge/core'

import type {
  BackupRestoreEntityItem,
  BackupRestoreEntityKind,
  BackupRestoreImportResult,
  BackupRestoreParsedFile,
} from '@/features/endge-admin/domain/types/backup-restore.types'

type ImportDoc = {
  id?: string | number | null
  identity?: string | null
  name?: string | null
  displayName?: string | null
  type?: DomainDocumentType | string | null
  [key: string]: unknown
}

interface EntityAdapter {
  getAll(domain: EndgeDomain): ImportDoc[]
  get(domain: EndgeDomain, idOrIdentity: string | number): ImportDoc | null
  add(domain: EndgeDomain, doc: ImportDoc): void
  removeByIdentity(domain: EndgeDomain, identity: string): void
}

interface BackupDocConfig {
  documentType: DomainDocumentType
  entityKind: BackupRestoreEntityKind
  sectionTitle: string
  getAll(domain: EndgeDomain): ImportDoc[]
}

interface ImportPlan {
  item: BackupRestoreEntityItem
  config: BackupDocConfig
  model: ImportDoc
  existsInCurrentDomain: boolean
}

const ENTITY_ADAPTERS: Record<BackupRestoreEntityKind, EntityAdapter> = {
  settings: {
    getAll: domain => domain.getSettings() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getSetting(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addSettings(doc as never),
    removeByIdentity: (domain, identity) => domain.removeSettingsByIdentity(identity),
  },
  project: {
    getAll: domain => domain.getProjects() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getProject(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addProject(doc as never),
    removeByIdentity: (domain, identity) => domain.removeProjectByIdentity(identity),
  },
  type: {
    getAll: domain => domain.getTypes().filter((item: any) => item?.isPrimitive !== true) as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getType(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addType(doc as never),
    removeByIdentity: (domain, identity) => domain.removeTypeByIdentity(identity),
  },
  query: {
    getAll: domain => domain.getQueries() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getQuery(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addQuery(doc as never),
    removeByIdentity: (domain, identity) => domain.removeQueryByIdentity(identity),
  },
  component: {
    getAll: domain => domain.getComponents() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getComponent(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addComponent(doc as never),
    removeByIdentity: (domain, identity) => domain.removeComponentByIdentity(identity),
  },
  scenario: {
    getAll: domain => domain.getScenarios() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getScenario(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addScenario(doc as never),
    removeByIdentity: (domain, identity) => domain.removeScenarioByIdentity(identity),
  },
  action: {
    getAll: domain => domain.getActions() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getAction(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addAction(doc as never),
    removeByIdentity: (domain, identity) => domain.removeActionByIdentity(identity),
  },
  parameter: {
    getAll: domain => domain.getParameters() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getParameter(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addParameter(doc as never),
    removeByIdentity: (domain, identity) => domain.removeParameterByIdentity(identity),
  },
  filter: {
    getAll: domain => domain.getFilters() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getFilter(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addFilter(doc as never),
    removeByIdentity: (domain, identity) => domain.removeFilterByIdentity(identity),
  },
  converter: {
    getAll: domain => domain.getConverters() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getConverter(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addConverter(doc as never),
    removeByIdentity: (domain, identity) => domain.removeConverterByIdentity(identity),
  },
  integration: {
    getAll: domain => domain.getIntegrations() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getIntegration(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addIntegration(doc as never),
    removeByIdentity: (domain, identity) => domain.removeIntegrationByIdentity(identity),
  },
  environment: {
    getAll: domain => domain.getEnvironments() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getEnvironment(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addEnvironment(doc as never),
    removeByIdentity: (domain, identity) => domain.removeEnvironmentByIdentity(identity),
  },
  tenant: {
    getAll: domain => domain.getTenants() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getTenant(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addTenant(doc as never),
    removeByIdentity: (domain, identity) => domain.removeTenantByIdentity(identity),
  },
  'behavior-binding': {
    getAll: domain => domain.getBehaviorBindings() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getBehaviorBinding(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addBehaviorBinding(doc as never),
    removeByIdentity: (domain, identity) => domain.removeBehaviorBindingByIdentity(identity),
  },
  'presentation-binding': {
    getAll: domain => domain.getPresentationBindings() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getPresentationBinding(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addPresentationBinding(doc as never),
    removeByIdentity: (domain, identity) => domain.removePresentationBindingByIdentity(identity),
  },
  policy: {
    getAll: domain => domain.getPolicies() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getPolicy(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addPolicy(doc as never),
    removeByIdentity: (domain, identity) => domain.removePolicyByIdentity(identity),
  },
  style: {
    getAll: domain => domain.getStyles() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getStyle(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addStyle(doc as never),
    removeByIdentity: (domain, identity) => domain.removeStyleByIdentity(identity),
  },
  vocabs: {
    getAll: domain => domain.getVocabs() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getVocab(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addVocabs(doc as never),
    removeByIdentity: (domain, identity) => domain.removeVocabsByIdentity(identity),
  },
  view: {
    getAll: domain => domain.getViews() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getView(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addView(doc as never),
    removeByIdentity: (domain, identity) => domain.removeViewByIdentity(identity),
  },
  'page-template': {
    getAll: domain => domain.getPageTemplates() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getPageTemplate(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addPageTemplate(doc as never),
    removeByIdentity: (domain, identity) => domain.removePageTemplateByIdentity(identity),
  },
  page: {
    getAll: domain => domain.getPages() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getPage(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addPage(doc as never),
    removeByIdentity: (domain, identity) => domain.removePageByIdentity(identity),
  },
  navigation: {
    getAll: domain => domain.getNavigations() as unknown as ImportDoc[],
    get: (domain, idOrIdentity) => domain.getNavigation(idOrIdentity) as ImportDoc | null,
    add: (domain, doc) => domain.addNavigation(doc as never),
    removeByIdentity: (domain, identity) => domain.removeNavigationByIdentity(identity),
  },
}

const BACKUP_DOC_CONFIGS: BackupDocConfig[] = [
  { documentType: 'settings', entityKind: 'settings', sectionTitle: 'Настройки', getAll: domain => ENTITY_ADAPTERS.settings.getAll(domain) },
  { documentType: 'environment', entityKind: 'environment', sectionTitle: 'Окружения', getAll: domain => ENTITY_ADAPTERS.environment.getAll(domain) },
  { documentType: 'tenant', entityKind: 'tenant', sectionTitle: 'Тенанты', getAll: domain => ENTITY_ADAPTERS.tenant.getAll(domain) },
  { documentType: 'policy', entityKind: 'policy', sectionTitle: 'Политики', getAll: domain => ENTITY_ADAPTERS.policy.getAll(domain) },
  { documentType: 'style', entityKind: 'style', sectionTitle: 'Стили', getAll: domain => ENTITY_ADAPTERS.style.getAll(domain) },
  { documentType: 'vocabs', entityKind: 'vocabs', sectionTitle: 'Словари', getAll: domain => ENTITY_ADAPTERS.vocabs.getAll(domain) },
  { documentType: 'type', entityKind: 'type', sectionTitle: 'Типы', getAll: domain => ENTITY_ADAPTERS.type.getAll(domain) },
  { documentType: 'converter', entityKind: 'converter', sectionTitle: 'Конвертеры', getAll: domain => ENTITY_ADAPTERS.converter.getAll(domain) },
  { documentType: 'integration', entityKind: 'integration', sectionTitle: 'Интеграции', getAll: domain => ENTITY_ADAPTERS.integration.getAll(domain) },
  { documentType: ParameterType.DefaultParameter, entityKind: 'parameter', sectionTitle: 'Параметры', getAll: domain => ENTITY_ADAPTERS.parameter.getAll(domain) },
  { documentType: FilterType.DefaultFilter, entityKind: 'filter', sectionTitle: 'Фильтры', getAll: domain => ENTITY_ADAPTERS.filter.getAll(domain) },
  { documentType: QueryType.REST, entityKind: 'query', sectionTitle: 'REST запросы', getAll: domain => ENTITY_ADAPTERS.query.getAll(domain).filter(doc => doc.type === QueryType.REST) },
  { documentType: QueryType.GraphQL, entityKind: 'query', sectionTitle: 'GraphQL запросы', getAll: domain => ENTITY_ADAPTERS.query.getAll(domain).filter(doc => doc.type === QueryType.GraphQL) },
  { documentType: QueryType.Custom, entityKind: 'query', sectionTitle: 'Custom запросы', getAll: domain => ENTITY_ADAPTERS.query.getAll(domain).filter(doc => doc.type === QueryType.Custom) },
  { documentType: ScriptType.ScenarioSetup, entityKind: 'scenario', sectionTitle: 'Сценарии', getAll: domain => ENTITY_ADAPTERS.scenario.getAll(domain) },
  { documentType: 'action', entityKind: 'action', sectionTitle: 'Действия', getAll: domain => ENTITY_ADAPTERS.action.getAll(domain) },
  { documentType: ComponentType.DSL, entityKind: 'component', sectionTitle: 'DSL компоненты', getAll: domain => ENTITY_ADAPTERS.component.getAll(domain).filter(doc => doc.type === ComponentType.DSL) },
  { documentType: ComponentType.Table, entityKind: 'component', sectionTitle: 'Табличные компоненты', getAll: domain => ENTITY_ADAPTERS.component.getAll(domain).filter(doc => doc.type === ComponentType.Table) },
  { documentType: 'view', entityKind: 'view', sectionTitle: 'Виды', getAll: domain => ENTITY_ADAPTERS.view.getAll(domain) },
  { documentType: 'page-template', entityKind: 'page-template', sectionTitle: 'Шаблоны страниц', getAll: domain => ENTITY_ADAPTERS['page-template'].getAll(domain) },
  { documentType: 'page', entityKind: 'page', sectionTitle: 'Страницы', getAll: domain => ENTITY_ADAPTERS.page.getAll(domain) },
  { documentType: 'navigation', entityKind: 'navigation', sectionTitle: 'Навигации', getAll: domain => ENTITY_ADAPTERS.navigation.getAll(domain) },
  { documentType: 'project', entityKind: 'project', sectionTitle: 'Проекты', getAll: domain => ENTITY_ADAPTERS.project.getAll(domain) },
  { documentType: 'behavior-binding', entityKind: 'behavior-binding', sectionTitle: 'Behavior Bindings', getAll: domain => ENTITY_ADAPTERS['behavior-binding'].getAll(domain) },
  { documentType: 'presentation-binding', entityKind: 'presentation-binding', sectionTitle: 'Presentation Bindings', getAll: domain => ENTITY_ADAPTERS['presentation-binding'].getAll(domain) },
]

function makeItemKey(documentType: DomainDocumentType, identity: string): string {
  return `${String(documentType)}::${identity}`
}

function isNumericLike(value: unknown): boolean {
  if (typeof value === 'number')
    return Number.isFinite(value)
  const text = String(value ?? '').trim()
  return !!text && /^-?\d+$/.test(text)
}

function toNumericOrNull(value: unknown): number | null {
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : null
  const text = String(value ?? '').trim()
  if (!text)
    return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeId(value: unknown): string | number | null {
  if (value == null)
    return null
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : null
  const text = String(value).trim()
  if (!text)
    return null
  const parsed = Number(text)
  return Number.isFinite(parsed) && /^-?\d+$/.test(text) ? parsed : text
}

function titleForDoc(doc: ImportDoc): string {
  return String(doc.displayName ?? doc.name ?? doc.identity ?? doc.id ?? 'Без имени')
}

function extractPlainDomain(raw: unknown): { source: 'bundle' | 'plain', plainDomain: Record<string, unknown> } {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    if (obj.domain && typeof obj.domain === 'object' && !Array.isArray(obj.domain)) {
      return {
        source: 'bundle',
        plainDomain: obj.domain as Record<string, unknown>,
      }
    }
    return {
      source: 'plain',
      plainDomain: obj,
    }
  }
  throw new Error('Файл резервной копии должен содержать JSON-объект.')
}

function kindFromBindingScope(value: unknown): BackupRestoreEntityKind | null {
  const kind = String(value ?? '').trim().toLowerCase()
  if (!kind)
    return null
  if (kind === 'table-cell')
    return null
  if (kind === 'page-template')
    return 'page-template'
  if (kind === 'behavior-binding')
    return 'behavior-binding'
  if (kind === 'presentation-binding')
    return 'presentation-binding'
  if (kind in ENTITY_ADAPTERS)
    return kind as BackupRestoreEntityKind
  return null
}

function allocateNextId(
  kind: BackupRestoreEntityKind,
  preferredId: string | number | null,
  identity: string,
  usedIds: Set<string>,
): string | number {
  const adapter = ENTITY_ADAPTERS[kind]
  const idKey = (id: string | number) => `${kind}::${String(id)}`

  if (preferredId != null) {
    const current = adapter.get(Endge.domain, preferredId)
    if (!current && !usedIds.has(idKey(preferredId)))
      return preferredId
  }

  if (isNumericLike(preferredId)) {
    const taken = new Set<number>()
    for (const item of adapter.getAll(Endge.domain)) {
      const id = toNumericOrNull(item.id)
      if (id != null)
        taken.add(id)
    }
    for (const key of usedIds) {
      if (!key.startsWith(`${kind}::`))
        continue
      const id = toNumericOrNull(key.slice(kind.length + 2))
      if (id != null)
        taken.add(id)
    }
    let nextId = 1
    while (taken.has(nextId))
      nextId += 1
    return nextId
  }

  let candidate = identity
  let index = 2
  while (adapter.get(Endge.domain, candidate) || usedIds.has(idKey(candidate))) {
    candidate = `${identity}-${index}`
    index += 1
  }
  return candidate
}

function resolveLinkedId(
  kind: BackupRestoreEntityKind | null,
  importedRef: unknown,
  importedDomain: EndgeDomain,
  finalIdsByKindIdentity: Map<string, string | number>,
): string | number | null {
  if (!kind)
    return normalizeId(importedRef)

  const adapter = ENTITY_ADAPTERS[kind]
  const identityKey = (identity: string) => `${kind}::${identity}`

  if (typeof importedRef === 'string') {
    const text = importedRef.trim()
    if (!text)
      return null
    if (!isNumericLike(text)) {
      const finalByIdentity = finalIdsByKindIdentity.get(identityKey(text))
      if (finalByIdentity != null)
        return finalByIdentity
      const currentByIdentity = adapter.get(Endge.domain, text)
      if (currentByIdentity?.id != null)
        return normalizeId(currentByIdentity.id)
    }
  }

  const importedDoc = adapter.get(importedDomain, importedRef as string | number)
  if (importedDoc?.identity) {
    const finalByIdentity = finalIdsByKindIdentity.get(identityKey(String(importedDoc.identity)))
    if (finalByIdentity != null)
      return finalByIdentity
    const currentByIdentity = adapter.get(Endge.domain, String(importedDoc.identity))
    if (currentByIdentity?.id != null)
      return normalizeId(currentByIdentity.id)
    return normalizeId(importedDoc.id)
  }

  const current = importedRef != null ? adapter.get(Endge.domain, importedRef as string | number) : null
  if (current?.id != null)
    return normalizeId(current.id)

  return normalizeId(importedRef)
}

function remapDocumentReferences(
  plan: ImportPlan,
  importedDomain: EndgeDomain,
  finalIdsByKindIdentity: Map<string, string | number>,
): void {
  const model = plan.model as any

  if (plan.config.documentType === ComponentType.Table) {
    for (const column of model.columns ?? []) {
      if (column?.componentId != null)
        column.componentId = resolveLinkedId('component', column.componentId, importedDomain, finalIdsByKindIdentity)
      for (const binding of column?.eventBindings ?? []) {
        if (binding?.actionId != null) {
          const actionId = resolveLinkedId('action', binding.actionId, importedDomain, finalIdsByKindIdentity)
          binding.actionId = actionId == null ? null : String(actionId)
        }
      }
    }
    return
  }

  if (plan.config.documentType === 'view') {
    model.componentId = resolveLinkedId('component', model.componentId, importedDomain, finalIdsByKindIdentity)
    model.filterId = resolveLinkedId('filter', model.filterId, importedDomain, finalIdsByKindIdentity)
    model.queryId = resolveLinkedId('query', model.queryId, importedDomain, finalIdsByKindIdentity)
    return
  }

  if (plan.config.documentType === 'page') {
    model.templateId = resolveLinkedId('page-template', model.templateId, importedDomain, finalIdsByKindIdentity)
    model.controllerId = resolveLinkedId('view', model.controllerId, importedDomain, finalIdsByKindIdentity)
    for (const area of model.areas ?? []) {
      for (const block of area?.blocks ?? []) {
        const kind = kindFromBindingScope(block?.entityType)
        const nextId = resolveLinkedId(kind, block?.entityId ?? block?.entityIdentity, importedDomain, finalIdsByKindIdentity)
        block.entityId = toNumericOrNull(nextId) ?? nextId
        if (!block.entityIdentity && kind && block.entityId != null) {
          const linked = ENTITY_ADAPTERS[kind].get(importedDomain, block.entityId)
          if (linked?.identity)
            block.entityIdentity = String(linked.identity)
        }
      }
    }
    return
  }

  if (plan.config.documentType === 'project') {
    model.settingsId = resolveLinkedId('settings', model.settingsId, importedDomain, finalIdsByKindIdentity)
    model.navigationId = resolveLinkedId('navigation', model.navigationId, importedDomain, finalIdsByKindIdentity)
    model.allowedEnvironmentIds = Array.from(new Set(
      (Array.isArray(model.allowedEnvironmentIds) ? model.allowedEnvironmentIds : [])
        .map((value: unknown) => resolveLinkedId('environment', value, importedDomain, finalIdsByKindIdentity))
        .map((value: unknown) => toNumericOrNull(value))
        .filter((value: number | null): value is number => value != null),
    ))
    return
  }

  if (plan.config.documentType === 'behavior-binding') {
    model.projectId = resolveLinkedId('project', model.projectId, importedDomain, finalIdsByKindIdentity)
    model.environmentId = resolveLinkedId('environment', model.environmentId, importedDomain, finalIdsByKindIdentity)
    model.originBindingId = resolveLinkedId('behavior-binding', model.originBindingId, importedDomain, finalIdsByKindIdentity)
    model.ownerId = resolveLinkedId(kindFromBindingScope(model.ownerType), model.ownerId, importedDomain, finalIdsByKindIdentity)
    model.targetId = resolveLinkedId(kindFromBindingScope(model.targetType), model.targetId, importedDomain, finalIdsByKindIdentity)
    return
  }

  if (plan.config.documentType === 'presentation-binding') {
    model.projectId = resolveLinkedId('project', model.projectId, importedDomain, finalIdsByKindIdentity)
    model.environmentId = resolveLinkedId('environment', model.environmentId, importedDomain, finalIdsByKindIdentity)
    model.originBindingId = resolveLinkedId('presentation-binding', model.originBindingId, importedDomain, finalIdsByKindIdentity)
    model.ownerId = resolveLinkedId(kindFromBindingScope(model.ownerType), model.ownerId, importedDomain, finalIdsByKindIdentity)
    model.targetId = resolveLinkedId(kindFromBindingScope(model.targetType), model.targetId, importedDomain, finalIdsByKindIdentity)
  }
}

function replaceDomainDocument(plan: ImportPlan): void {
  const adapter = ENTITY_ADAPTERS[plan.config.entityKind]
  const identity = String(plan.model.identity ?? '')
  if (!identity)
    throw new Error(`У импортируемого документа отсутствует identity: ${String(plan.config.documentType)}`)
  adapter.removeByIdentity(Endge.domain, identity)
  adapter.add(Endge.domain, plan.model)
}

export function parseBackupRestoreFile(text: string, fileName: string): BackupRestoreParsedFile {
  let rawJson: unknown
  try {
    rawJson = JSON.parse(text)
  }
  catch (error) {
    throw new Error(`Не удалось распарсить JSON: ${String(error)}`)
  }

  const { source, plainDomain } = extractPlainDomain(rawJson)
  const importedDomain = EndgeDomainClass.fromPlain(plainDomain)

  const items = BACKUP_DOC_CONFIGS.flatMap((config) => {
    return config.getAll(importedDomain).map((doc) => {
      const identity = String(doc.identity ?? '').trim()
      const current = identity ? ENTITY_ADAPTERS[config.entityKind].get(Endge.domain, identity) : null
      return {
        key: makeItemKey(config.documentType, identity || String(doc.id ?? Math.random())),
        documentType: config.documentType,
        entityKind: config.entityKind,
        sectionTitle: config.sectionTitle,
        title: titleForDoc(doc),
        identity,
        importedId: normalizeId(doc.id),
        existsInCurrentDomain: current != null,
        currentId: normalizeId(current?.id),
      } satisfies BackupRestoreEntityItem
    }).filter(item => item.identity)
  })

  return {
    fileName,
    source,
    plainDomain,
    importedDomain,
    items,
  }
}

export async function importBackupRestoreSelection(
  parsed: BackupRestoreParsedFile,
  selectedKeys: string[],
): Promise<BackupRestoreImportResult> {
  const importedDomain = parsed.importedDomain as EndgeDomain
  const selected = new Set(selectedKeys)
  const plans: ImportPlan[] = []
  const usedIds = new Set<string>()
  const finalIdsByKindIdentity = new Map<string, string | number>()

  for (const item of parsed.items) {
    if (!selected.has(item.key))
      continue
    const config = BACKUP_DOC_CONFIGS.find(cfg => cfg.documentType === item.documentType && cfg.entityKind === item.entityKind)
    if (!config)
      continue

    const model = ENTITY_ADAPTERS[config.entityKind].get(importedDomain, item.identity) as ImportDoc | null
    if (!model)
      continue

    const current = ENTITY_ADAPTERS[config.entityKind].get(Endge.domain, item.identity)
    const preferredId = current?.id != null ? normalizeId(current.id) : normalizeId(model.id)
    const finalId = current?.id != null
      ? normalizeId(current.id)
      : allocateNextId(config.entityKind, preferredId, item.identity, usedIds)

    model.id = finalId
    usedIds.add(`${config.entityKind}::${String(finalId)}`)
    finalIdsByKindIdentity.set(`${config.entityKind}::${item.identity}`, finalId as string | number)

    plans.push({
      item,
      config,
      model,
      existsInCurrentDomain: current != null,
    })
  }

  for (const plan of plans)
    replaceDomainDocument(plan)

  const orderedPlans = plans.sort((a, b) => {
    const ai = BACKUP_DOC_CONFIGS.findIndex(cfg => cfg.documentType === a.config.documentType && cfg.entityKind === a.config.entityKind)
    const bi = BACKUP_DOC_CONFIGS.findIndex(cfg => cfg.documentType === b.config.documentType && cfg.entityKind === b.config.entityKind)
    return ai - bi
  })

  let replacedCount = 0
  let createdCount = 0

  for (const plan of orderedPlans) {
    remapDocumentReferences(plan, importedDomain, finalIdsByKindIdentity)
    await Endge.schema.saveDocument(
      String(plan.model.id ?? plan.model.identity ?? ''),
      plan.config.documentType,
      { model: plan.model },
    )

    const current = ENTITY_ADAPTERS[plan.config.entityKind].get(Endge.domain, String(plan.model.identity ?? ''))
    if (current?.id != null) {
      plan.model.id = current.id
      finalIdsByKindIdentity.set(`${plan.config.entityKind}::${String(plan.model.identity ?? '')}`, normalizeId(current.id) as string | number)
    }

    if (plan.existsInCurrentDomain)
      replacedCount += 1
    else
      createdCount += 1
  }

  return {
    importedCount: orderedPlans.length,
    replacedCount,
    createdCount,
  }
}
