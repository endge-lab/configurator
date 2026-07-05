import type { RPageTemplate, RPageTemplatePreviewSchema } from '@endge/core'

/** Модель редактора для RPageTemplate (коллекция page-templates). */
export class RPageTemplateEditor {
  id!: number
  identity!: string
  displayName!: string
  description: string = ''
  areas: Array<{
    identity: string
    title?: string
    description?: string
  }> = []

  preview: RPageTemplatePreviewSchema | null = null

  fillFromSource(source: RPageTemplate): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.name ?? '').trim()
    this.description = source.description ?? ''
    this.areas = Array.isArray(source.areas)
      ? source.areas.map(a => ({
          identity: a.identity,
          title: a.title ?? undefined,
          description: a.description ?? undefined,
        }))
      : []
    this.preview = source.preview ?? null
  }

  updateSource(source: RPageTemplate): void {
    source.id = this.id as number
    source.identity = this.identity
    source.name = this.displayName
    source.description = this.description || null
    source.areas = this.areas.map(a => ({
      identity: a.identity,
      title: (a.title && a.title.trim()) ? a.title : a.identity,
      description: a.description ?? null,
    }))
    source.preview = this.preview ?? null
  }
}
