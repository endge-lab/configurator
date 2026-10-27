import type { QueryProgramPayload, QueryProgramProp } from '@endge/core'

import { evaluateSourceExpression } from '@endge/core'

// Элемент ввода значения prop в панели запуска.
export type QueryRunFieldControl = 'text' | 'number' | 'boolean' | 'json'

// Prop Query из defineProps в виде поля формы запуска.
export interface QueryRunField {
  key: string
  // Тип для подписи: `String`, `Number[]`.
  typeLabel: string
  control: QueryRunFieldControl
  optional: boolean
  // Литеральный default в текстовом виде; пустое поле формы означает «использовать default».
  defaultText: string | null
  // Default вычисляется Filter во время выполнения.
  defaultFromFilter: boolean
}

export interface QueryRunForm {
  protocol: 'REST' | 'GraphQL'
  fields: QueryRunField[]
  payload: QueryProgramPayload | null
  // Первая ошибка компиляции Source; при ней запуск невозможен.
  compileError: string | null
}

// Текстовые значения формы по ключу prop; '' — значение не задано.
export type QueryRunFormValues = Record<string, string>

export interface QueryRunParsedValues {
  props: Record<string, unknown>
  errors: Record<string, string>
}

export interface QueryRunVariablesPreview {
  value: unknown
  error: string | null
}

// Значение Select для boolean без явного выбора.
export const QUERY_RUN_DEFAULT_OPTION = 'default'

const TEXT_TYPES = new Set(['String', 'Date', 'Time', 'DateTime'])

/**
 * Строит форму запуска из результата компиляции Source Query без побочных эффектов.
 */
export function readQueryRunForm(compiled: { artifact?: unknown, diagnostics?: unknown[] }): QueryRunForm {
  const compileError = firstCompileError(compiled.diagnostics)
  const payload = isQueryPayload(compiled.artifact) ? compiled.artifact : null
  return {
    protocol: payload?.type === 'query-gql' ? 'GraphQL' : 'REST',
    fields: (payload?.props ?? []).map(readQueryRunField),
    payload,
    compileError: compileError ?? (payload ? null : 'Query source is not compiled'),
  }
}

/**
 * Разбирает текстовые значения формы в props по типам полей.
 * Пустое значение не передаётся, чтобы runtime применил default из defineProps.
 */
export function parseQueryRunValues(fields: readonly QueryRunField[], values: QueryRunFormValues): QueryRunParsedValues {
  const props: Record<string, unknown> = {}
  const errors: Record<string, string> = {}
  for (const field of fields) {
    const raw = values[field.key] ?? ''
    if (raw.trim() === '' || raw === QUERY_RUN_DEFAULT_OPTION) {
      continue
    }
    const parsed = parseFieldValue(field, raw)
    if (parsed.error) {
      errors[field.key] = parsed.error
      continue
    }
    props[field.key] = parsed.value
  }
  return { props, errors }
}

/**
 * Query запускается одним кликом, если каждый prop необязателен или имеет default
 * (литеральный или из Filter): форма не требует ввода.
 */
export function canRunQueryWithoutInput(props: readonly QueryProgramProp[] | null | undefined): boolean {
  return Array.isArray(props) && props.every(prop => prop.optional || Boolean(prop.defaultValue) || Boolean(prop.defaultSource))
}

/**
 * Литеральные default props, как их применяет QueryRuntimeHost до запуска.
 */
export function readQueryRunDefaults(payload: QueryProgramPayload | null): Record<string, unknown> {
  const defaults: Record<string, unknown> = {}
  for (const prop of payload?.props ?? []) {
    if (!prop.defaultValue) {
      continue
    }
    try {
      defaults[prop.key] = evaluateSourceExpression(prop.defaultValue)
    }
    catch {
      // Невычислимый default остаётся на стороне runtime.
    }
  }
  return defaults
}

/**
 * Вычисляет итоговые GraphQL variables для текущих props без отправки запроса.
 */
export function previewGraphQLVariables(
  payload: QueryProgramPayload | null,
  props: Record<string, unknown>,
  environment: (name: string) => unknown,
): QueryRunVariablesPreview {
  if (!payload || payload.type !== 'query-gql') {
    return { value: null, error: null }
  }
  if (!payload.requestVariables) {
    return { value: {}, error: null }
  }
  try {
    const value = evaluateSourceExpression(payload.requestVariables, {
      props: { ...readQueryRunDefaults(payload), ...props },
      environment,
    })
    return { value: value ?? {}, error: null }
  }
  catch (error) {
    return { value: null, error: error instanceof Error ? error.message : String(error) }
  }
}

function readQueryRunField(prop: QueryProgramProp): QueryRunField {
  return {
    key: prop.key,
    typeLabel: `${prop.type}${prop.array ? '[]' : ''}`,
    control: fieldControl(prop),
    optional: prop.optional,
    defaultText: readDefaultText(prop),
    defaultFromFilter: Boolean(prop.defaultSource),
  }
}

function fieldControl(prop: QueryProgramProp): QueryRunFieldControl {
  if (prop.array) {
    return 'json'
  }
  if (prop.type === 'Number') {
    return 'number'
  }
  if (prop.type === 'Boolean') {
    return 'boolean'
  }
  return TEXT_TYPES.has(prop.type) ? 'text' : 'json'
}

function readDefaultText(prop: QueryProgramProp): string | null {
  if (!prop.defaultValue) {
    return null
  }
  try {
    const value = evaluateSourceExpression(prop.defaultValue)
    return typeof value === 'string' ? value : JSON.stringify(value) ?? null
  }
  catch {
    return null
  }
}

function parseFieldValue(field: QueryRunField, raw: string): { value?: unknown, error?: string } {
  const text = raw.trim()
  switch (field.control) {
    case 'number': {
      const value = Number(text)
      return Number.isFinite(value) ? { value } : { error: 'number' }
    }
    case 'boolean':
      if (text === 'true' || text === 'false') {
        return { value: text === 'true' }
      }
      return { error: 'boolean' }
    case 'json':
      try {
        return { value: JSON.parse(text) }
      }
      catch {
        // Any принимает и обычную строку.
        return field.typeLabel === 'Any' ? { value: raw } : { error: 'json' }
      }
    default:
      return { value: raw }
  }
}

function firstCompileError(diagnostics: unknown[] | undefined): string | null {
  for (const diagnostic of diagnostics ?? []) {
    if (diagnostic && typeof diagnostic === 'object' && (diagnostic as { severity?: unknown }).severity === 'error') {
      const message = (diagnostic as { message?: unknown }).message
      return typeof message === 'string' && message ? message : 'Query source has compile errors'
    }
  }
  return null
}

function isQueryPayload(value: unknown): value is QueryProgramPayload {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as QueryProgramPayload).props))
}
