import type {
  ProgramDiagnostic,
  QuerySourceDocument,
  QuerySourceOutput,
  QuerySourcePatchPath,
  RQuery,
} from '@endge/core'

import { Endge } from '@endge/core'

/** Source-first editor model для `RQuery`. */
export class RQueryEditor {
  id!: number
  identity!: string
  name!: string
  source: string = ''
  sourceVersion: number = 1
  endpoint: string = ''
  path: string = ''
  method: string = 'POST'
  headersText: string = '{}'
  authMode: 'token' | 'none' = 'token'
  subField: string = 'items'
  returnExpression: string = 'null'
  mockEnabled: boolean = false
  mockDataText: string = 'null'
  diagnostics: unknown[] = []

  /** Заполняет editor только canonical source-полями. */
  fillFromSource(source: RQuery): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.name = source.name
    this.source = String((source as { source?: string }).source ?? '')
    this.sourceVersion = Number((source as { sourceVersion?: number }).sourceVersion ?? 1) || 1
    this.refreshFieldsFromSource()
  }

  /** Обновляет только source-поля, не трогая legacy payload fields. */
  updateSource(target: RQuery): void {
    target.id = this.id
    target.identity = this.identity
    target.name = this.name
    target.displayName = this.name
    target.source = this.source
    target.sourceVersion = this.sourceVersion
  }

  /** Применяет ручное изменение source и синхронизирует UI-проекцию. */
  applySourceText(source: string): void {
    this.source = source
    this.refreshFieldsFromSource()
  }

  /** Точечно патчит source после изменения UI-поля. */
  patchSource(path: QuerySourcePatchPath, value: unknown, expression?: string): void {
    const result = Endge.source.patch('query', this.source, {
      path,
      value,
      expression,
    })

    this.source = result.source
    this.diagnostics = result.diagnostics ?? []
    this.refreshFieldsFromSource()
  }

  /** Обновляет UI-поля из canonical source document. */
  refreshFieldsFromSource(): void {
    try {
      const result = Endge.source.parse<QuerySourceDocument>('query', this.source)
      this.diagnostics = result.diagnostics ?? []
      if (!result.document)
        return

      this.applyDocumentProjection(result.document)
    }
    catch (error) {
      this.diagnostics = [createEditorDiagnostic(error)]
    }
  }

  /** Патчит endpoint, сохраняя env(...) для var-token вида `{ENDPOINT}`. */
  patchEndpoint(value: string): void {
    this.patchSource('request.endpoint', value, endpointExpression(value))
  }

  /** Патчит headers из JSON-текста. */
  patchHeadersText(value: string): void {
    this.headersText = value
    const parsed = parseEditorJson(value)
    if (!parsed.ok)
      return

    this.patchSource('request.headers', parsed.value)
  }

  /** Патчит auth mode как минимальный auth object. */
  patchAuthMode(value: 'token' | 'none'): void {
    this.patchSource('request.auth', { mode: value })
  }

  /** Патчит response.return из raw DSL expression. */
  patchReturnExpression(value: string): void {
    this.returnExpression = value
    const expression = value.trim() || 'null'
    const result = Endge.source.patch('query', this.source, {
      path: 'response.return',
      value: null,
      expression,
    })

    this.diagnostics = result.diagnostics ?? []
    if (!result.ok)
      return

    this.source = result.source
    this.refreshFieldsFromSource()
  }

  /** Патчит mock data из JSON-текста. */
  patchMockDataText(value: string): void {
    this.mockDataText = value
    const parsed = parseEditorJson(value)
    if (!parsed.ok)
      return

    this.patchSource('mock.data', parsed.value)
  }

  private applyDocumentProjection(document: QuerySourceDocument): void {
    const legacyResponse = readLegacyResponse(document)

    this.endpoint = document.request?.endpoint ?? ''
    this.path = document.request?.path ?? ''
    this.method = document.request?.method ?? 'POST'
    this.headersText = stringifyEditorJson(document.request?.headers ?? {})
    this.authMode = document.request?.auth?.mode === 'none' ? 'none' : 'token'
    this.subField = legacyResponse?.subField ?? readRawResponsePath(document.outputs)
    this.returnExpression = printFieldExpression(legacyResponse?.return)
    this.mockEnabled = document.mock?.enabled ?? false
    this.mockDataText = stringifyEditorJson(document.mock?.data ?? null)
  }
}

function endpointExpression(value: string): string | undefined {
  const match = value.trim().match(/^\{([^{}'"]+)\}$/)
  return match ? `env('${escapeSingleQuoted(match[1])}')` : undefined
}

function readLegacyResponse(document: QuerySourceDocument): { subField?: string, return?: unknown } | null {
  const response = (document as unknown as { response?: unknown }).response
  return response && typeof response === 'object'
    ? response as { subField?: string, return?: unknown }
    : null
}

function readRawResponsePath(outputs: QuerySourceOutput[] | undefined): string {
  const rawOutput = outputs?.find(output => output.key === 'raw' && output.source.type === 'response')
  const responseOutput = rawOutput ?? outputs?.find(output => output.source.type === 'response')
  if (!responseOutput || responseOutput.source.type !== 'response')
    return ''

  return responseOutput.source.path ?? ''
}

function printFieldExpression(field: unknown): string {
  if (!isSourceField(field))
    return 'null'

  let out = `field('${escapeSingleQuoted(field.type)}')`
  if (field.isArray)
    out += '.array()'
  if (field.optional)
    out += '.optional()'

  return out
}

function isSourceField(value: unknown): value is { type: string, isArray?: boolean, optional?: boolean } {
  return Boolean(value && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string')
}

function stringifyEditorJson(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2)
}

function parseEditorJson(value: string): { ok: true, value: unknown } | { ok: false } {
  try {
    return {
      ok: true,
      value: JSON.parse(value),
    }
  }
  catch {
    return { ok: false }
  }
}

function escapeSingleQuoted(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')
}

function createEditorDiagnostic(error: unknown): ProgramDiagnostic {
  return {
    severity: 'error',
    code: 'query-source-editor-projection-error',
    message: error instanceof Error
      ? error.message
      : String(error),
    sourcePath: 'source',
  }
}
