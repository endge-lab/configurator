/**
 * Управляющие команды LLM для домена: создание, обновление (полное или по полям), удаление сущностей.
 * LLM может в конце ответа вставить блок ```domain-ops с JSON.
 */

import { DomainSectionType, Endge } from '@endge/core'
import { Serialize } from '@endge/utils'

export type DomainOpCreate = { op: 'create', type: string, body: Record<string, unknown> }
export type DomainOpUpdateFull = { op: 'update', type: string, identity: string, body: Record<string, unknown> }
export type DomainOpUpdatePatch = { op: 'update', type: string, identity: string, patch: Record<string, unknown> }
export type DomainOpDelete = { op: 'delete', type: string, identity: string }

export type DomainOp = DomainOpCreate | DomainOpUpdateFull | DomainOpUpdatePatch | DomainOpDelete

const DOMAIN_OPS_BLOCK_REG = /```(?:domain-ops|json)\s*([\s\S]*?)```/g
const DOMAIN_OPS_KEY = 'domainOps'

function parseDomainOpsFromBlock(raw: string): DomainOp[] | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const json = JSON.parse(trimmed)
    if (Array.isArray(json) && json.length > 0)
      return json as DomainOp[]
    const ops = (json as { domainOps?: DomainOp[] })[DOMAIN_OPS_KEY]
    if (!Array.isArray(ops) || ops.length === 0) return null
    return ops
  }
  catch {
    return null
  }
}

/**
 * Извлекает из текста ответа агента массив операций domainOps (блок ```domain-ops или ```json).
 * Поддерживает формат {"domainOps": [...]} и массив в корне [...].
 */
export function parseDomainOpsFromMessage(text: string): DomainOp[] | null {
  if (!text?.trim()) return null
  let m: RegExpExecArray | null
  DOMAIN_OPS_BLOCK_REG.lastIndex = 0
  while ((m = DOMAIN_OPS_BLOCK_REG.exec(text)) !== null) {
    const ops = parseDomainOpsFromBlock(m[1])
    if (ops?.length) return ops
  }
  return null
}

/** Ключ коллекции домена (merge) -> DomainSectionType для get/remove. */
const MERGE_KEY_TO_SECTION: Record<string, DomainSectionType> = {
  queries: DomainSectionType.Query,
  components: DomainSectionType.Component,
  types: DomainSectionType.Type,
  parameters: DomainSectionType.Parameters,
  filters: DomainSectionType.Filters,
  actions: DomainSectionType.Action,
  converters: DomainSectionType.Converter,
  integrations: DomainSectionType.Integration,
  environments: DomainSectionType.Environment,
  tenants: DomainSectionType.Tenant,
  policies: DomainSectionType.Policy,
  styles: DomainSectionType.Style,
  vocabs: DomainSectionType.Vocabs,
  navigations: DomainSectionType.Navigation,
  pageTemplates: DomainSectionType.PageTemplate,
  pages: DomainSectionType.Page,
  projects: DomainSectionType.Project,
  i18nBundles: DomainSectionType.I18nBundles,
  authProfiles: DomainSectionType.AuthProfile,
  stores: DomainSectionType.Store,
}

function getEntityByMergeKey(type: string, identity: string): unknown {
  const section = MERGE_KEY_TO_SECTION[type]
  if (section == null) return null
  const domain = Endge.domain as any
  const id = identity
  const numId = /^\d+$/.test(identity) ? Number(identity) : null
  switch (section) {
    case DomainSectionType.Query:
      return (numId != null ? domain.getQueryById?.(numId) : null) ?? domain.getQueryByIdentity?.(id) ?? domain.getQuery?.(id)
    case DomainSectionType.Component:
      return domain.getComponentByIdentity?.(id) ?? domain.getComponent?.(id)
    case DomainSectionType.Parameters:
      return (numId != null ? domain.getParameterById?.(numId) : null) ?? domain.getParameterIdentity?.(id)
    case DomainSectionType.Filters:
      return (numId != null ? domain.getFilterById?.(numId) : null) ?? domain.getFilter?.(id)
    case DomainSectionType.Type:
    case DomainSectionType.Primitive:
      return (numId != null ? domain.getTypeById?.(numId) : null) ?? domain.getType?.(id)
    case DomainSectionType.Action:
      return (numId != null ? domain.getActionById?.(numId) : null) ?? domain.getAction?.(id)
    case DomainSectionType.Converter:
      return (numId != null ? domain.getConverterById?.(numId) : null) ?? domain.getConverter?.(id)
    case DomainSectionType.Integration:
      return (numId != null ? domain.getIntegrationById?.(numId) : null) ?? domain.getIntegration?.(id)
    case DomainSectionType.Environment:
      return (numId != null ? domain.getEnvironmentById?.(numId) : null) ?? domain.getEnvironment?.(id)
    case DomainSectionType.Tenant:
      return (numId != null ? domain.getTenantById?.(numId) : null) ?? domain.getTenant?.(id)
    case DomainSectionType.Policy:
      return (numId != null ? domain.getPolicyById?.(numId) : null) ?? domain.getPolicy?.(id)
    case DomainSectionType.Style:
      return (numId != null ? domain.getStyleById?.(numId) : null) ?? domain.getStyle?.(id)
    case DomainSectionType.PageTemplate:
      return (numId != null ? domain.getPageTemplateById?.(numId) : null) ?? domain.getPageTemplate?.(id)
    case DomainSectionType.Page:
      return (numId != null ? domain.getPageById?.(numId) : null) ?? domain.getPage?.(id)
    case DomainSectionType.Navigation:
      return (numId != null ? domain.getNavigationById?.(numId) : null) ?? domain.getNavigation?.(id)
    case DomainSectionType.Vocabs:
      return (numId != null ? domain.getVocabById?.(numId) : null) ?? domain.getVocab?.(id)
    case DomainSectionType.I18nBundles:
      return (numId != null ? domain.getI18nBundleById?.(numId) : null) ?? domain.getI18nBundle?.(id)
    case DomainSectionType.AuthProfile:
      return (numId != null ? domain.getAuthProfileById?.(numId) : null) ?? domain.getAuthProfile?.(id)
    case DomainSectionType.Project:
      return (numId != null ? domain.getProjectById?.(numId) : null) ?? domain.getProject?.(id)
    case DomainSectionType.Store:
      return (numId != null ? domain.getStoreById?.(numId) : null) ?? domain.getStore?.(id)
    default:
      return null
  }
}

function removeEntityByMergeKey(type: string, entity: any): void {
  const section = MERGE_KEY_TO_SECTION[type]
  if (section == null) return
  const domain = Endge.domain as any
  const rem = (fn: (x: any) => void) => { fn(entity) }
  switch (section) {
    case DomainSectionType.Query:
      rem(domain.removeQuery?.bind(domain))
      break
    case DomainSectionType.Component:
      rem(domain.removeComponent?.bind(domain))
      break
    case DomainSectionType.Parameters:
      rem(domain.removeParameter?.bind(domain))
      break
    case DomainSectionType.Filters:
      rem(domain.removeFilter?.bind(domain))
      break
    case DomainSectionType.Type:
    case DomainSectionType.Primitive:
      rem(domain.removeType?.bind(domain))
      break
    case DomainSectionType.Action:
      rem(domain.removeAction?.bind(domain))
      break
    case DomainSectionType.Converter:
      rem(domain.removeConverter?.bind(domain))
      break
    case DomainSectionType.Integration:
      rem(domain.removeIntegration?.bind(domain))
      break
    case DomainSectionType.Environment:
      rem(domain.removeEnvironment?.bind(domain))
      break
    case DomainSectionType.Tenant:
      rem(domain.removeTenant?.bind(domain))
      break
    case DomainSectionType.Policy:
      rem(domain.removePolicy?.bind(domain))
      break
    case DomainSectionType.Style:
      rem(domain.removeStyle?.bind(domain))
      break
    case DomainSectionType.PageTemplate:
      rem(domain.removePageTemplate?.bind(domain))
      break
    case DomainSectionType.Page:
      rem(domain.removePage?.bind(domain))
      break
    case DomainSectionType.Navigation:
      rem(domain.removeNavigation?.bind(domain))
      break
    case DomainSectionType.Vocabs:
      rem(domain.removeVocabs?.bind(domain))
      break
    case DomainSectionType.I18nBundles:
      rem(domain.removeI18nBundles?.bind(domain))
      break
    case DomainSectionType.AuthProfile:
      rem(domain.removeAuthProfile?.bind(domain))
      break
    case DomainSectionType.Project:
      rem(domain.removeProject?.bind(domain))
      break
    case DomainSectionType.Store:
      rem(domain.removeStore?.bind(domain))
      break
    default:
      break
  }
}

function isMergeKeySupported(type: string): boolean {
  return type in MERGE_KEY_TO_SECTION || type === 'folders'
}

function toPlain(entity: any): Record<string, unknown> {
  if (entity && typeof entity.toPlain === 'function')
    return entity.toPlain() as Record<string, unknown>
  try {
    return Serialize.toPlain(entity) as Record<string, unknown>
  }
  catch {
    return { ...entity } as Record<string, unknown>
  }
}

function deepMerge(target: Record<string, unknown>, patch: Record<string, unknown>): void {
  for (const k of Object.keys(patch)) {
    const v = patch[k]
    if (v != null && typeof v === 'object' && !Array.isArray(v) && typeof (target as any)[k] === 'object') {
      deepMerge((target as any)[k] as Record<string, unknown>, v as Record<string, unknown>)
    }
    else {
      (target as any)[k] = v
    }
  }
}

export interface ApplyDomainOpsResult {
  applied: number
  errors: string[]
}

/**
 * Применяет массив операций к домену: create (merge), update (remove + merge или patch + remove + merge), delete (remove).
 */
export function applyDomainOps(ops: DomainOp[]): ApplyDomainOpsResult {
  const errors: string[] = []
  let applied = 0
  const domain = Endge.domain

  for (const op of ops) {
    const type = String(op.type ?? '').trim()
    if (!type) {
      errors.push('Операция без type пропущена')
      continue
    }
    if (!isMergeKeySupported(type)) {
      errors.push(`Тип "${type}" не поддерживается для операций домена`)
      continue
    }

    if (op.op === 'create') {
      const body = (op as DomainOpCreate).body
      if (!body || typeof body !== 'object') {
        errors.push(`create: для типа "${type}" нужен body (объект)`)
        continue
      }
      try {
        domain.merge({ [type]: [body] })
        applied++
      }
      catch (e) {
        errors.push(`create ${type}: ${e instanceof Error ? e.message : String(e)}`)
      }
      continue
    }

    if (op.op === 'delete') {
      const identity = String((op as DomainOpDelete).identity ?? '')
      if (!identity) {
        errors.push(`delete: для типа "${type}" нужен identity`)
        continue
      }
      const entity = getEntityByMergeKey(type, identity)
      if (!entity) {
        errors.push(`delete: сущность "${type}" с identity "${identity}" не найдена`)
        continue
      }
      try {
        removeEntityByMergeKey(type, entity)
        applied++
      }
      catch (e) {
        errors.push(`delete ${type}/${identity}: ${e instanceof Error ? e.message : String(e)}`)
      }
      continue
    }

    if (op.op === 'update') {
      const identity = String((op as DomainOpUpdateFull).identity ?? '')
      if (!identity) {
        errors.push(`update: для типа "${type}" нужен identity`)
        continue
      }
      const entity = getEntityByMergeKey(type, identity)
      if (!entity) {
        errors.push(`update: сущность "${type}" с identity "${identity}" не найдена`)
        continue
      }
      let plain: Record<string, unknown>
      if ('patch' in op && op.patch && typeof op.patch === 'object') {
        plain = toPlain(entity)
        deepMerge(plain, op.patch)
      }
      else if ('body' in op && op.body && typeof op.body === 'object') {
        plain = op.body as Record<string, unknown>
      }
      else {
        errors.push(`update: для типа "${type}" нужен body или patch`)
        continue
      }
      try {
        removeEntityByMergeKey(type, entity)
        domain.merge({ [type]: [plain] })
        applied++
      }
      catch (e) {
        errors.push(`update ${type}/${identity}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  if (applied > 0)
    domain.notify()

  return { applied, errors }
}
