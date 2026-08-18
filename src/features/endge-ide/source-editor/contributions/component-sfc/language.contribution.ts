/* eslint-disable style/max-statements-per-line */
import type { ScriptEditorExtension } from '@/features/endge-ide/source-editor/adapters/monaco/script-editor-extension.types'
import type {
  ComponentSFCAttributeAnalysisOptions,
  ComponentSFCTagAttributeContract,
  ComponentSFCTagAttributeLiteral,
  RComponentSFC_AST_Attribute,
  RComponentSFC_AST_TemplateNode,
} from '@endge/core'
import type * as Monaco from 'monaco-editor'

import {
  parseComponentSFC,
  resolveComponentSFCTagAttributeContracts,
  validateComponentSFCAttributeValues,
} from '@endge/core'
import ts from 'typescript'

const SCRIPT_PATTERN = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi
const TEMPLATE_OPEN_PATTERN = /<template\b[^>]*>/i
const TEMPLATE_CLOSE_PATTERN = /<\/template\s*>/gi
const DYNAMIC_ATTRIBUTE_PATTERN = /(?:^|\s)(?::[\w.-]+|#[\w.-]+|v-bind:[\w.-]+|@[\w.-]+|v-on:[\w.-]+|v-(?:if|else-if|for|show|model|slot|text|html|memo)(?:[:.][\w-]+){0,3})\s*=\s*(["'])([\s\S]*?)\1/gi
const INTERPOLATION_PATTERN = /\{\{([\s\S]*?)\}\}/g

type ExpressionTokenKind = 'comment' | 'identifier' | 'keyword' | 'number' | 'operator' | 'property' | 'string'

interface SourceExpression {
  start: number
  source: string
}

interface Delimiter {
  kind: ts.SyntaxKind
  offset: number
}

interface SFCEditableCompletionSpec {
  label: string
  detail: string
  insertText: string
}

export interface SFCLanguageContributionOptions extends ComponentSFCAttributeAnalysisOptions {}

interface SFCAttributeCompletionContext {
  tag: string
  kind: 'name' | 'value'
  attributeName?: string
  dynamic: boolean
  existingAttributes: Set<string>
  replaceStart: number
  replaceEnd: number
}

interface SFCAttributeReference {
  tag: string
  attribute: RComponentSFC_AST_Attribute
}

const SFC_EDITABLE_COMPLETIONS: readonly SFCEditableCompletionSpec[] = [
  {
    label: 'Editable',
    detail: 'Display/edit structural variants with semantic edited event',
    insertText: `<Editable :value="\${1:value}" edit-on="\${2:dblclick}" @edited="\${3:emit('edited', event())}">
  <Variant name="default">
    \${4}
  </Variant>
  <Variant name="edit">
    \${5}
  </Variant>
</Editable>`,
  },
  {
    label: 'Variant default/edit',
    detail: 'Explicit default and edit variants',
    insertText: `<Variant name="default">
  \${1}
</Variant>
<Variant name="edit">
  \${2}
</Variant>`,
  },
  { label: 'editable', detail: 'Enable the edit controller', insertText: 'editable' },
  { label: 'edit-on', detail: 'Edit entry trigger; click by default, keyboard combinations via :edit-on', insertText: `edit-on="\${1:dblclick}"` },
  {
    label: 'edit-on shortcut',
    detail: 'Cross-platform keyboard combination for edit entry',
    insertText: `:edit-on="[{
  event: 'keydown',
  code: ['\${1:KeyE}'],
  modifiers: { mod: true, exact: true },
  repeat: false,
  composing: false,
  prevent: true,
  stop: true,
}]"`,
  },
  {
    label: 'edit-on held pointer chord',
    detail: 'Pointer trigger with held ordinary keys and physical modifiers',
    insertText: `:edit-on="[{
  event: 'contextmenu',
  button: 2,
  held: { code: ['\${1:KeyW}'], exact: true },
  modifiers: { shift: true, meta: true, exact: true },
  prevent: true,
  stop: true,
}]"`,
  },
  { label: 'variant', detail: 'Select a component variant explicitly', insertText: `variant="\${1:default}"` },
  { label: '@edited', detail: 'Handle a committed semantic edit', insertText: `@edited="\${1:emit('edited', event())}"` },
  { label: 'emit edited', detail: 'Publish edited from a custom edit variant', insertText: `emit('edited', event('\${1:value}'))` },
]

/** Adds SFC expression highlighting and TypeScript-aware folding to an HTML Monaco model. */
export function createSFCLanguageContribution(
  options: SFCLanguageContributionOptions = {},
): ScriptEditorExtension {
  return {
    id: 'component-sfc:language',
    install({ monaco, editor, model }) {
      const highlights = editor.createDecorationsCollection()
      let diagnosticsTimer: ReturnType<typeof setTimeout> | null = null
      const refreshHighlights = () => {
        highlights.set(collectExpressionDecorations(monaco, model))
      }
      const refreshDiagnostics = () => {
        const source = model.getValue()
        const parsed = parseComponentSFC(source)
        const diagnostics = validateComponentSFCAttributeValues(source, parsed.ast, options)
        monaco.editor.setModelMarkers(model, 'endge-sfc-attributes', diagnostics.map((diagnostic) => {
          const start = Math.max(0, diagnostic.start ?? 0)
          const end = Math.max(start + 1, diagnostic.end ?? start + 1)
          const startPosition = model.getPositionAt(start)
          const endPosition = model.getPositionAt(end)
          return {
            severity: monaco.MarkerSeverity.Error,
            message: diagnostic.message,
            code: diagnostic.code,
            startLineNumber: startPosition.lineNumber,
            startColumn: startPosition.column,
            endLineNumber: endPosition.lineNumber,
            endColumn: endPosition.column,
          }
        }))
      }
      const content = model.onDidChangeContent(() => {
        refreshHighlights()
        if (diagnosticsTimer) { clearTimeout(diagnosticsTimer) }
        diagnosticsTimer = setTimeout(() => {
          diagnosticsTimer = null
          refreshDiagnostics()
        }, 120)
      })
      const folding = monaco.languages.registerFoldingRangeProvider('html', {
        provideFoldingRanges(currentModel) {
          if (currentModel !== model) { return null }
          return collectScriptFoldingRanges(monaco, model)
        },
      })
      const completions = monaco.languages.registerCompletionItemProvider('html', {
        triggerCharacters: ['<', ' ', ':', '@', '-', '=', '"', '\''],
        provideCompletionItems(currentModel, position) {
          if (currentModel !== model) { return { suggestions: [] } }
          const template = findTemplateContentRange(model.getValue())
          const offset = model.getOffsetAt(position)
          if (!template || offset < template.start || offset > template.end) { return { suggestions: [] } }
          const attributeContext = resolveAttributeCompletionContext(model.getValue(), offset)
          if (attributeContext) {
            const contracts = resolveComponentSFCTagAttributeContracts(attributeContext.tag, options)
            const range = monaco.Range.fromPositions(
              model.getPositionAt(attributeContext.replaceStart),
              model.getPositionAt(attributeContext.replaceEnd),
            )
            if (attributeContext.kind === 'value' && attributeContext.attributeName) {
              const contract = findAttributeContract(contracts, attributeContext.attributeName)
              return {
                suggestions: (contract?.values ?? []).map(value => ({
                  label: String(value),
                  detail: `${attributeContext.tag}.${contract?.name} · ${contract?.description}`,
                  insertText: formatAttributeCompletionValue(value, attributeContext.dynamic),
                  range,
                  kind: monaco.languages.CompletionItemKind.Value,
                })),
              }
            }
            const genericAttributes = SFC_EDITABLE_COMPLETIONS
              .filter(item => ['editable', 'edit-on', 'edit-on shortcut', 'edit-on held pointer chord', 'variant', '@edited'].includes(item.label))
              .map(item => ({
                label: item.label,
                detail: item.detail,
                insertText: item.insertText,
                range,
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              }))
            return {
              suggestions: [
                ...contracts
                  .filter(contract => ![contract.name, ...(contract.aliases ?? [])]
                    .some(name => attributeContext.existingAttributes.has(name)))
                  .map(contract => ({
                    label: contract.name,
                    detail: `${attributeContext.tag} · ${contract.description}`,
                    insertText: attributeSnippet(contract),
                    range,
                    kind: monaco.languages.CompletionItemKind.Property,
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                  })),
                ...genericAttributes,
              ],
            }
          }
          const word = model.getWordUntilPosition(position)
          const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
          return {
            suggestions: SFC_EDITABLE_COMPLETIONS.map(item => ({
              label: item.label,
              detail: item.detail,
              insertText: item.insertText,
              range,
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            })),
          }
        },
      })
      const hover = monaco.languages.registerHoverProvider('html', {
        provideHover(currentModel, position) {
          if (currentModel !== model) { return null }
          const reference = findAttributeReference(model.getValue(), model.getOffsetAt(position))
          if (!reference) { return null }
          const contract = findAttributeContract(
            resolveComponentSFCTagAttributeContracts(reference.tag, options),
            reference.attribute.name,
          )
          if (!contract) { return null }
          const values = contract.values.map(formatHoverLiteral).join(' | ')
          const defaultLine = contract.defaultValue == null
            ? []
            : [{ value: `Default: \`${String(contract.defaultValue)}\`` }]
          return {
            range: monaco.Range.fromPositions(
              model.getPositionAt(reference.attribute.range.start),
              model.getPositionAt(reference.attribute.range.end),
            ),
            contents: [
              { value: `**${reference.tag}.${contract.name}**` },
              { value: contract.description },
              { value: `Values: ${values}` },
              ...defaultLine,
            ],
          }
        },
      })

      refreshHighlights()
      refreshDiagnostics()

      return {
        dispose() {
          if (diagnosticsTimer) { clearTimeout(diagnosticsTimer) }
          highlights.clear()
          monaco.editor.setModelMarkers(model, 'endge-sfc-attributes', [])
          content.dispose()
          folding.dispose()
          completions.dispose()
          hover.dispose()
        },
      }
    },
  }
}

function resolveAttributeCompletionContext(
  source: string,
  offset: number,
): SFCAttributeCompletionContext | null {
  const openingStart = source.lastIndexOf('<', offset)
  const previousClose = source.lastIndexOf('>', offset - 1)
  if (openingStart < 0 || openingStart <= previousClose) { return null }
  const prefix = source.slice(openingStart, offset)
  if (/^<\s*[!/]/.test(prefix)) { return null }
  const tagMatch = prefix.match(/^<([A-Z][\w.-]*)/i)
  const tag = tagMatch?.[1]
  if (!tag || prefix.length === tagMatch[0].length) { return null }

  const afterTag = prefix.slice(tagMatch[0].length)
  if (!/^\s/.test(afterTag)) { return null }
  const existingAttributes = new Set<string>()
  for (const match of afterTag.matchAll(/(?:^|\s)(?::|v-bind:)?([A-Za-z_][\w.-]*)/g)) {
    if (match[1]) { existingAttributes.add(match[1]) }
  }

  const valueMatch = afterTag.match(/(?:^|\s)(:|v-bind:)?([A-Za-z_][\w.-]*)\s*=\s*(["'])([^"']*)$/)
  if (valueMatch?.[2] != null && valueMatch[4] != null) {
    return {
      tag,
      kind: 'value',
      attributeName: valueMatch[2],
      dynamic: Boolean(valueMatch[1]),
      existingAttributes,
      replaceStart: offset - valueMatch[4].length,
      replaceEnd: offset,
    }
  }

  const nameMatch = afterTag.match(/(?:^|\s)([A-Z_][\w.-]*)$/i)
  const emptyName = /\s$/.test(afterTag)
  if (!nameMatch && !emptyName) { return null }
  const partial = nameMatch?.[1] ?? ''
  return {
    tag,
    kind: 'name',
    dynamic: false,
    existingAttributes,
    replaceStart: offset - partial.length,
    replaceEnd: offset,
  }
}

function findAttributeReference(source: string, offset: number): SFCAttributeReference | null {
  const ast = parseComponentSFC(source).ast
  const visit = (node: RComponentSFC_AST_TemplateNode): SFCAttributeReference | null => {
    if (node.kind !== 'element') { return null }
    const attribute = node.attributes.find(item => offset >= item.range.start && offset <= item.range.end)
    if (attribute) { return { tag: node.tag, attribute } }
    for (const child of node.children) {
      const reference = visit(child)
      if (reference) { return reference }
    }
    return null
  }
  for (const root of ast?.template?.roots ?? []) {
    const reference = visit(root)
    if (reference) { return reference }
  }
  return null
}

function findAttributeContract(
  contracts: readonly ComponentSFCTagAttributeContract[],
  name: string,
): ComponentSFCTagAttributeContract | null {
  return contracts.find(contract => contract.name === name || contract.aliases?.includes(name)) ?? null
}

function attributeSnippet(contract: ComponentSFCTagAttributeContract): string {
  const value = contract.defaultValue ?? contract.values[0] ?? ''
  if (typeof value === 'string') { return `${contract.name}="\${1:${value}}"` }
  return `:${contract.name}="\${1:${String(value)}}"`
}

function formatAttributeCompletionValue(
  value: ComponentSFCTagAttributeLiteral,
  dynamic: boolean,
): string {
  if (!dynamic) { return String(value) }
  return typeof value === 'string'
    ? JSON.stringify(value)
    : String(value)
}

function formatHoverLiteral(value: ComponentSFCTagAttributeLiteral): string {
  return `\`${typeof value === 'string' ? value : String(value)}\``
}

function collectExpressionDecorations(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
): Monaco.editor.IModelDeltaDecoration[] {
  const decorations: Monaco.editor.IModelDeltaDecoration[] = []

  for (const expression of collectTemplateExpressions(model.getValue())) {
    const scanner = ts.createScanner(
      ts.ScriptTarget.Latest,
      false,
      ts.LanguageVariant.Standard,
      expression.source,
    )
    let previousToken: ts.SyntaxKind | null = null

    for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
      if (isTrivia(token)) { continue }

      const start = expression.start + scanner.getTokenPos()
      const end = expression.start + scanner.getTextPos()
      if (end <= start) { continue }

      const tokenKind = classifyExpressionToken(token, previousToken)
      decorations.push({
        range: monaco.Range.fromPositions(
          model.getPositionAt(start),
          model.getPositionAt(end),
        ),
        options: {
          inlineClassName: `endge-sfc-expression-${tokenKind}`,
          inlineClassNameAffectsLetterSpacing: false,
        },
      })
      previousToken = token
    }
  }

  return decorations
}

function collectTemplateExpressions(source: string): SourceExpression[] {
  const expressions: SourceExpression[] = []
  const templateRange = findTemplateContentRange(source)
  if (!templateRange) { return expressions }
  const templateSource = source.slice(templateRange.start, templateRange.end)

  for (const match of templateSource.matchAll(DYNAMIC_ATTRIBUTE_PATTERN)) {
    const value = match[2] ?? ''
    const quote = match[1] ?? ''
    const matchStart = templateRange.start + (match.index ?? 0)
    const quoteOffset = match[0].indexOf(quote)
    if (!quote || quoteOffset < 0) { continue }

    expressions.push({
      start: matchStart + quoteOffset + quote.length,
      source: value,
    })
  }

  for (const match of templateSource.matchAll(INTERPOLATION_PATTERN)) {
    expressions.push({
      start: templateRange.start + (match.index ?? 0) + 2,
      source: match[1] ?? '',
    })
  }

  return expressions
}

function findTemplateContentRange(source: string): { start: number, end: number } | null {
  const opening = TEMPLATE_OPEN_PATTERN.exec(source)
  if (!opening) { return null }

  const start = (opening.index ?? 0) + opening[0].length
  let end = -1
  for (const closing of source.matchAll(TEMPLATE_CLOSE_PATTERN)) {
    end = closing.index ?? end
  }
  if (end < start) { return null }

  return { start, end }
}

function classifyExpressionToken(
  token: ts.SyntaxKind,
  previousToken: ts.SyntaxKind | null,
): ExpressionTokenKind {
  if (token === ts.SyntaxKind.Identifier || token === ts.SyntaxKind.PrivateIdentifier) {
    return previousToken === ts.SyntaxKind.DotToken || previousToken === ts.SyntaxKind.QuestionDotToken
      ? 'property'
      : 'identifier'
  }
  if (token >= ts.SyntaxKind.FirstKeyword && token <= ts.SyntaxKind.LastKeyword) { return 'keyword' }
  if (token === ts.SyntaxKind.NumericLiteral || token === ts.SyntaxKind.BigIntLiteral) { return 'number' }
  if (
    token === ts.SyntaxKind.StringLiteral
    || token === ts.SyntaxKind.RegularExpressionLiteral
    || token === ts.SyntaxKind.NoSubstitutionTemplateLiteral
    || token === ts.SyntaxKind.TemplateHead
    || token === ts.SyntaxKind.TemplateMiddle
    || token === ts.SyntaxKind.TemplateTail
  ) {
    return 'string'
  }
  if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) {
    return 'comment'
  }
  return 'operator'
}

function isTrivia(token: ts.SyntaxKind): boolean {
  return token === ts.SyntaxKind.WhitespaceTrivia
    || token === ts.SyntaxKind.NewLineTrivia
    || token === ts.SyntaxKind.ShebangTrivia
    || token === ts.SyntaxKind.ConflictMarkerTrivia
}

function collectScriptFoldingRanges(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
): Monaco.languages.FoldingRange[] {
  const ranges: Monaco.languages.FoldingRange[] = []

  for (const match of model.getValue().matchAll(SCRIPT_PATTERN)) {
    const script = match[1] ?? ''
    const scriptStart = (match.index ?? 0) + match[0].indexOf('>') + 1
    ranges.push(...scanScriptFoldingRanges(monaco, model, script, scriptStart))
  }

  return deduplicateFoldingRanges(ranges)
}

function scanScriptFoldingRanges(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
  script: string,
  scriptStart: number,
): Monaco.languages.FoldingRange[] {
  const ranges: Monaco.languages.FoldingRange[] = []
  const delimiters: Delimiter[] = []
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, script)

  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const tokenStart = scriptStart + scanner.getTokenPos()

    if (token === ts.SyntaxKind.MultiLineCommentTrivia) {
      const tokenEnd = scriptStart + scanner.getTextPos()
      const startLine = model.getPositionAt(tokenStart).lineNumber
      const endLine = model.getPositionAt(tokenEnd).lineNumber
      if (endLine > startLine) {
        ranges.push({ start: startLine, end: endLine, kind: monaco.languages.FoldingRangeKind.Comment })
      }
      continue
    }

    if (isOpeningDelimiter(token)) {
      delimiters.push({ kind: token, offset: tokenStart })
      continue
    }
    if (!isClosingDelimiter(token)) { continue }

    const openingKind = openingDelimiterFor(token)
    const openingIndex = findLastDelimiterIndex(delimiters, openingKind)
    if (openingIndex < 0) { continue }

    const [opening] = delimiters.splice(openingIndex, 1)
    if (!opening) { continue }

    const startLine = model.getPositionAt(opening.offset).lineNumber
    const closingLine = model.getPositionAt(tokenStart).lineNumber
    const endLine = closingLine - 1
    if (endLine > startLine) {
      ranges.push({ start: startLine, end: endLine })
    }
  }

  return ranges
}

function isOpeningDelimiter(token: ts.SyntaxKind): boolean {
  return token === ts.SyntaxKind.OpenBraceToken || token === ts.SyntaxKind.OpenBracketToken
}

function isClosingDelimiter(token: ts.SyntaxKind): boolean {
  return token === ts.SyntaxKind.CloseBraceToken || token === ts.SyntaxKind.CloseBracketToken
}

function openingDelimiterFor(token: ts.SyntaxKind): ts.SyntaxKind {
  return token === ts.SyntaxKind.CloseBracketToken
    ? ts.SyntaxKind.OpenBracketToken
    : ts.SyntaxKind.OpenBraceToken
}

function findLastDelimiterIndex(delimiters: Delimiter[], kind: ts.SyntaxKind): number {
  for (let index = delimiters.length - 1; index >= 0; index -= 1) {
    if (delimiters[index]?.kind === kind) { return index }
  }
  return -1
}

function deduplicateFoldingRanges(ranges: Monaco.languages.FoldingRange[]): Monaco.languages.FoldingRange[] {
  const unique = new Map<string, Monaco.languages.FoldingRange>()
  for (const range of ranges) {
    unique.set(`${range.start}:${range.end}:${range.kind?.value ?? ''}`, range)
  }
  return Array.from(unique.values()).sort((left, right) => left.start - right.start || right.end - left.end)
}
