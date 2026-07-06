import {
  parseSFCSourceParts,
  type RComponentSFCSource_Parts,
} from '@endge/core'

/**
 * Редакторская модель SFC-компонента.
 *
 * Source остается единственным persisted и authoring-полем. `sourceParts`
 * хранится только как derived-состояние для diagnostics/debug UI.
 */
export class RComponentSFCEditor {
  id!: number

  identity!: string

  name!: string

  displayName!: string

  description: string | null = null

  folderId?: string | number | null = null

  project?: string | null = null

  modelVersion = 1

  supportedTargets: Array<'dom' | 'canvas'> = ['dom', 'canvas']

  meta: Record<string, unknown> = {}

  inherited = false

  source = ''

  sourceParts: RComponentSFCSource_Parts = parseSFCSourceParts('')

  /** Заполняет редактор из persisted SFC-модели. */
  fillFromSource(source: any): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.name = source.name
    this.displayName = source.displayName ?? source.name
    this.description = source.description ?? null
    this.folderId = source.folderId ?? null
    this.project = source.project ?? null
    this.modelVersion = Number(source.modelVersion ?? 1)
    this.supportedTargets = normalizeTargets(source.supportedTargets)
    this.meta = { ...(source.meta ?? {}) }
    this.inherited = source.inherited === true
    this.source = source.source ?? ''
    this.sourceParts = parseSFCSourceParts(this.source)
  }

  /** Переносит редакторское состояние обратно в persisted SFC-модель. */
  updateSource(source: any): void {
    this.parseSource()
    source.id = this.id
    source.identity = this.identity
    source.name = this.name
    source.displayName = this.displayName || this.name
    source.description = this.description
    source.folderId = this.folderId ?? null
    source.project = this.project ?? null
    source.modelVersion = Number(this.modelVersion ?? 1)
    source.supportedTargets = normalizeTargets(this.supportedTargets)
    source.meta = { ...this.meta }
    source.inherited = this.inherited
    source.source = this.source
  }

  /** Обновляет вкладки из полного source, если пользователь редактировал raw preview. */
  parseSource(): void {
    this.sourceParts = parseSFCSourceParts(this.source)
  }
}

/** Оставляет только targets, которые поддерживает SFC v1. */
function normalizeTargets(raw: unknown): Array<'dom' | 'canvas'> {
  if (!Array.isArray(raw))
    return ['dom', 'canvas']

  const targets = raw.filter((target): target is 'dom' | 'canvas' => target === 'dom' || target === 'canvas')
  return targets.length ? Array.from(new Set(targets)) : ['dom', 'canvas']
}
