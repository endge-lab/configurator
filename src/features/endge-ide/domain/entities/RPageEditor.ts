import type { RPage } from '@endge/core'

function normalizeRelationId(value: unknown): number | null {
  if (value == null)
    return null
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : null
  const text = String(value).trim()
  if (!text)
    return null
  const id = Number(text)
  return Number.isFinite(id) ? id : null
}

/** Модель редактора для RPage (коллекция pages). */
export class RPageEditor {
  id!: number
  identity!: string
  displayName!: string
  description: string = ''
  routeName: string = ''
  routePath: string = ''
  templateId: number | null = null
  controllerId: number | null = null
  enabled: boolean = true

  areas: Array<{
    slotId: string
    blocks: Array<{
      key: string
      entityType?: string | null
      entityId?: number | null
      entityIdentity?: string | null
      titleOverride?: string | null
      visibleWhen?: string | null
      props?: Record<string, unknown> | null
    }>
  }> = []

  fillFromSource(source: RPage): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.name ?? '').trim()
    this.description = source.description ?? ''
    this.routeName = source.routeName ?? ''
    this.routePath = source.routePath ?? ''
    this.templateId = normalizeRelationId(source.templateId)
    this.controllerId = normalizeRelationId(source.controllerId)
    this.enabled = source.enabled ?? true
    this.areas = Array.isArray(source.areas)
      ? source.areas.map(a => ({
          slotId: a.slotId,
          blocks: Array.isArray(a.blocks)
            ? a.blocks.map(b => ({
                key: b.key,
                entityType: b.entityType ?? null,
                entityId: b.entityId ?? null,
                entityIdentity: b.entityIdentity ?? null,
                titleOverride: b.titleOverride ?? null,
                visibleWhen: b.visibleWhen ?? null,
                props: b.props ?? null,
              }))
            : [],
        }))
      : []
  }

  /**
   * Синхронизирует список областей с областями шаблона.
   * Сохраняет блоки для областей, чей slotId есть в шаблоне.
   */
  syncAreasFromTemplate(templateAreas: Array<{ identity: string }>): void {
    if (!Array.isArray(templateAreas) || templateAreas.length === 0) {
      this.areas = []
      return
    }
    this.areas = templateAreas.map(t => ({
      slotId: t.identity,
      blocks: this.areas.find(a => a.slotId === t.identity)?.blocks?.slice() ?? [],
    }))
  }

  updateSource(source: RPage): void {
    const sourceLegacy = source as RPage & {
      templateIdentity?: string | number | null
      controllerIdentity?: string | number | null
    }
    source.id = this.id
    source.identity = this.identity
    source.name = this.displayName
    source.description = this.description || null
    source.routeName = this.routeName || null
    source.routePath = this.routePath || null
    source.templateId = this.templateId
    source.controllerId = this.controllerId
    // legacy aliases are cleared to avoid persisting mutable identity links
    sourceLegacy.templateIdentity = null
    sourceLegacy.controllerIdentity = null
    source.enabled = this.enabled
    source.areas = this.areas.map(a => ({
      slotId: a.slotId,
      blocks: a.blocks.map(b => ({
        key: b.key,
        entityType: b.entityType ?? null,
        entityId: b.entityId ?? null,
        entityIdentity: b.entityIdentity ?? null,
        titleOverride: b.titleOverride ?? null,
        visibleWhen: b.visibleWhen ?? null,
        props: b.props ?? null,
      })),
    }))
  }
}
