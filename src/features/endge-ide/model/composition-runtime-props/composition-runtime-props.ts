/* eslint-disable style/max-statements-per-line */
import type {
  CompositionPreviewLiteral,
  CompositionPreviewProps,
  CompositionPreviewPropValue,
  CompositionProgramPayload,
  CompositionRuntimeDescriptor,
  SourceFieldDefinition,
} from '@endge/core'

export interface CompositionRuntimePropsContract {
  props: SourceFieldDefinition[]
  previewProps?: CompositionPreviewProps | null
}

export interface CompositionRuntimePropsIssue {
  runtimePath: string
  runtimeIdentity: string
  severity: 'warning' | 'error'
  message: string
  missingProps: string[]
  previewProps: CompositionPreviewProps
  generatedProps: Record<string, CompositionPreviewLiteral>
  canGenerate: boolean
  range: { start: number, end: number }
  actionAnchor: number
}

/** Находит обязательные props вложенных Composition, не связанные вызывающим source. */
export function analyzeCompositionRuntimeProps(
  owner: CompositionProgramPayload | null,
  resolveContract: (identity: string) => CompositionRuntimePropsContract | null,
  materializePreviewValue: (value: CompositionPreviewPropValue) => CompositionPreviewLiteral | undefined
    = materializeLiteralPreviewValue,
): CompositionRuntimePropsIssue[] {
  if (!owner) { return [] }

  return owner.runtimes.flatMap((runtime) => {
    if (runtime.kind !== 'composition') { return [] }

    const target = resolveContract(runtime.identity)
    if (!target) { return [] }

    const requiredProps = target.props.filter(prop => !prop.optional && prop.defaultValue === undefined)
    const missingProps = requiredProps
      .map(prop => prop.key)
      .filter(prop => !Object.prototype.hasOwnProperty.call(runtime.props, prop))

    if (!missingProps.length) { return [] }

    const previewProps = Object.fromEntries(
      missingProps.flatMap((prop) => {
        const value = target.previewProps?.[prop]
        return value ? [[prop, value]] : []
      }),
    ) as CompositionPreviewProps
    const previewPropNames = Object.keys(previewProps)
    const hasPreviewForAll = previewPropNames.length === missingProps.length
    const generatedProps = Object.fromEntries(
      missingProps.flatMap((prop) => {
        const previewValue = previewProps[prop]
        if (!previewValue) { return [] }
        const value = materializePreviewValue(previewValue)
        return value === undefined ? [] : [[prop, value]]
      }),
    ) as Record<string, CompositionPreviewLiteral>
    const canGenerate = hasPreviewForAll && Object.keys(generatedProps).length === missingProps.length
    const missingPreviewProps = missingProps.filter(prop => !Object.prototype.hasOwnProperty.call(previewProps, prop))
    const locations = runtime.sourceLocations
    const range = locations?.call ?? locations?.runtime ?? { start: 0, end: 1 }

    return [{
      runtimePath: runtime.path,
      runtimeIdentity: runtime.identity,
      severity: hasPreviewForAll ? 'warning' : 'error',
      message: !hasPreviewForAll
        ? `Composition "${runtime.identity}" требует props: ${missingProps.join(', ')}. Для ${missingPreviewProps.join(', ')} нет preview fixture.`
        : canGenerate
          ? `Composition "${runtime.identity}" требует props: ${missingProps.join(', ')}. Preview fixtures доступны — сгенерируйте явный .withProps(...).`
          : `Composition "${runtime.identity}" требует props: ${missingProps.join(', ')}. Preview fixtures объявлены, но их mock-данные сейчас недоступны для генерации.`,
      missingProps,
      previewProps,
      generatedProps,
      canGenerate,
      range,
      actionAnchor: locations?.call.end ?? range.end,
    }]
  })
}

/** Добавляет отсутствующие preview-backed props в существующий runtime chain. */
export function generateCompositionRuntimeProps(
  source: string,
  owner: CompositionProgramPayload,
  issue: CompositionRuntimePropsIssue,
): string {
  if (!issue.canGenerate) { return source }

  const runtime = owner.runtimes.find(item => item.path === issue.runtimePath && item.identity === issue.runtimeIdentity)
  const locations = runtime?.sourceLocations
  if (!runtime || !locations) { return source }

  const entries = issue.missingProps.flatMap((prop) => {
    const value = issue.generatedProps[prop]
    return value === undefined ? [] : [[prop, value] as const]
  })
  if (entries.length !== issue.missingProps.length) { return source }

  return locations.withProps
    ? insertIntoWithProps(source, locations.withProps, entries)
    : insertWithPropsModifier(source, runtime, entries)
}

/** Создаёт preview-only source overlay для всех nested Composition с доступными fixtures. */
export function generateCompositionRuntimePreviewSource(
  source: string,
  compile: (source: string) => CompositionProgramPayload | null,
  resolveContract: (identity: string) => CompositionRuntimePropsContract | null,
  materializePreviewValue: (value: CompositionPreviewPropValue) => CompositionPreviewLiteral | undefined,
): string {
  let generated = source
  const maxIterations = Math.max(1, (compile(source)?.runtimes.length ?? 0) * 2)

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const owner = compile(generated)
    if (!owner) { return generated }
    const issue = analyzeCompositionRuntimeProps(owner, resolveContract, materializePreviewValue)
      .find(item => item.canGenerate)
    if (!issue) { return generated }

    const next = generateCompositionRuntimeProps(generated, owner, issue)
    if (next === generated) { return generated }
    generated = next
  }

  return generated
}

function insertIntoWithProps(
  source: string,
  range: { start: number, end: number },
  entries: ReadonlyArray<readonly [string, CompositionPreviewLiteral]>,
): string {
  const openOffset = range.start
  const closeOffset = Math.max(openOffset + 1, range.end - 1)
  const body = source.slice(openOffset + 1, closeOffset)
  const closeIndent = lineIndentAt(source, closeOffset)
  const propertyIndent = inferPropertyIndent(body, closeIndent)
  const serialized = serializeEntries(entries, propertyIndent)

  if (!body.trim()) {
    return `${source.slice(0, openOffset + 1)}\n${serialized}\n${closeIndent}${source.slice(closeOffset)}`
  }

  const bodyEnd = openOffset + 1 + body.search(/\s*$/) - 1
  const lastCharacter = source[bodyEnd]
  const separator = lastCharacter === ',' ? '' : ','
  return `${source.slice(0, bodyEnd + 1)}${separator}\n${serialized}\n${closeIndent}${source.slice(closeOffset)}`
}

function insertWithPropsModifier(
  source: string,
  runtime: CompositionRuntimeDescriptor,
  entries: ReadonlyArray<readonly [string, CompositionPreviewLiteral]>,
): string {
  const locations = runtime.sourceLocations!
  const callEnd = locations.call.end
  const runtimeTail = source.slice(callEnd, locations.runtime.end)
  const nextModifierIndent = runtimeTail.match(/\n([ \t]*)\./)?.[1]
  const modifierIndent = nextModifierIndent ?? `${lineIndentAt(source, locations.runtime.start)}  `
  const propertyIndent = `${modifierIndent}  `
  const serialized = serializeEntries(entries, propertyIndent)
  const modifier = `\n${modifierIndent}.withProps({\n${serialized}\n${modifierIndent}})`

  return `${source.slice(0, callEnd)}${modifier}${source.slice(callEnd)}`
}

function serializeEntries(
  entries: ReadonlyArray<readonly [string, CompositionPreviewLiteral]>,
  indent: string,
): string {
  return entries.map(([key, value]) => {
    const serialized = JSON.stringify(value, null, 2)
      .split('\n')
      .map((line, index) => index === 0 ? line : `${indent}${line}`)
      .join('\n')
    return `${indent}${serializePropertyKey(key)}: ${serialized}`
  }).join(',\n')
}

function materializeLiteralPreviewValue(value: CompositionPreviewPropValue): CompositionPreviewLiteral | undefined {
  return value.kind === 'literal' ? value.value : undefined
}

function serializePropertyKey(value: string): string {
  return /^[A-Z_$][\w$]*$/i.test(value) ? value : JSON.stringify(value)
}

function inferPropertyIndent(body: string, closeIndent: string): string {
  const firstPropertyIndent = body.match(/\n([ \t]*)\S/)?.[1]
  return firstPropertyIndent ?? `${closeIndent}  `
}

function lineIndentAt(source: string, offset: number): string {
  const lineStart = source.lastIndexOf('\n', Math.max(0, offset - 1)) + 1
  return source.slice(lineStart, offset).match(/^[ \t]*/)?.[0] ?? ''
}
