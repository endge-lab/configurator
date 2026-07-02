interface RComponentSFCSourceParts {
  script: { content: string }
  template: { content: string }
  style: { content: string, scoped: boolean }
  variants: Array<{
    name: string
    when: string
    priority: number
    target: 'dom' | 'canvas' | 'any'
    template: string
    style?: string
  }>
}

/**
 * Редакторская модель SFC-компонента.
 *
 * Source остается единственным persisted-полем, а вкладки являются удобным
 * представлением для UI и пересобираются обратно перед сохранением.
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

  sourceParts: RComponentSFCSourceParts = parseSFCSourceParts('')

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
    this.source = serializeSFCSourceParts(this.sourceParts)
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

  /** Обновляет полный source из вкладок без сохранения в доменную модель. */
  syncSourceFromParts(): void {
    this.sourceParts = cloneSFCSourceParts(this.sourceParts)
    this.source = serializeSFCSourceParts(this.sourceParts)
  }
}

/** Оставляет только targets, которые поддерживает SFC v1. */
function normalizeTargets(raw: unknown): Array<'dom' | 'canvas'> {
  if (!Array.isArray(raw))
    return ['dom', 'canvas']

  const targets = raw.filter((target): target is 'dom' | 'canvas' => target === 'dom' || target === 'canvas')
  return targets.length ? Array.from(new Set(targets)) : ['dom', 'canvas']
}

/** Создает пустую форму sourceParts для редактора. */
function createEmptySFCSourceParts(): RComponentSFCSourceParts {
  return {
    script: { content: '' },
    template: { content: '' },
    style: { content: '', scoped: true },
    variants: [],
  }
}

/** Копирует вкладки source, чтобы Vue-editor не делил ссылку с parser result. */
function cloneSFCSourceParts(parts: RComponentSFCSourceParts): RComponentSFCSourceParts {
  return {
    script: { content: parts.script.content },
    template: { content: parts.template.content },
    style: { content: parts.style.content, scoped: parts.style.scoped },
    variants: parts.variants.map(variant => ({ ...variant })),
  }
}

/** Простой parser v1 для вкладок SFC-редактора. */
function parseSFCSourceParts(source: string): RComponentSFCSourceParts {
  const parts = createEmptySFCSourceParts()
  parts.script.content = extractBlock(source, 'script') ?? ''
  parts.template.content = extractBlock(source, 'template') ?? ''
  const style = extractBlockWithAttrs(source, 'style')
  parts.style.content = style?.content ?? ''
  parts.style.scoped = Boolean(style?.attrs.includes('scoped'))
  return parts
}

/** Собирает вкладки редактора обратно в canonical SFC-source. */
function serializeSFCSourceParts(parts: RComponentSFCSourceParts): string {
  const styleScoped = parts.style.scoped ? ' scoped' : ''
  const chunks = [
    '<script setup lang="ts">',
    parts.script.content.trim(),
    '</' + 'script>',
    '',
    '<template>',
    parts.template.content.trim(),
    '</template>',
  ]

  if (parts.style.content.trim()) {
    chunks.push('', `<style lang="endgecss"${styleScoped}>`, parts.style.content.trim(), '</style>')
  }

  return `${chunks.join('\n')}\n`
}

/** Вытаскивает содержимое первого тега. */
function extractBlock(source: string, tag: string): string | null {
  return extractBlockWithAttrs(source, tag)?.content ?? null
}

/** Вытаскивает содержимое первого тега вместе с атрибутами. */
function extractBlockWithAttrs(source: string, tag: string): { attrs: string, content: string } | null {
  const pattern = new RegExp(`<${tag}([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const match = source.match(pattern)
  if (!match) return null

  return {
    attrs: match[1] ?? '',
    content: (match[2] ?? '').trim(),
  }
}
