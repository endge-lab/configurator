import type {
  UIEditorDocument,
  UIEditorNode,
  UIEditorNodeLayout,
  UIEditorSFCAttributeBinding,
  UIEditorSFCTextSegment,
  UIEditorSourceNodeLocations,
} from '@/features/endge-admin-ui-editor/types'
import type {
  ComponentSFCPreviewProps,
  RComponentSFC_AST_Attribute,
  RComponentSFC_AST_ElementNode,
  RComponentSFC_AST_TemplateNode,
} from '@endge/core'
import type { SFCVueRenderContext } from '@endge/vue'

import { compileComponentSFC, parseComponentSFC } from '@endge/core'
import { evaluateSFCExpression } from '@endge/vue'

import { printUIEditorDocumentSFC, printUIEditorDocumentTemplate } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-jsx'
import {
  UI_EDITOR_SFC_ATTRIBUTE_BINDINGS_META_KEY,
  UI_EDITOR_SFC_CONTENT_PREVIEW_META_KEY,
  UI_EDITOR_SFC_TEXT_SEGMENTS_META_KEY,
} from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-bindings'
import {
  getUIEditorSFCDefinitionContract,
  UI_EDITOR_SFC_DEFINITION_CONTRACTS,
} from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-contract'

export interface UIEditorSFCSourceProjection {
  document: UIEditorDocument | null
  diagnostics: string[]
  sourceLocations: UIEditorSourceNodeLocations
}

export function findUIEditorSourceNodeAtOffset(
  sourceLocations: UIEditorSourceNodeLocations,
  offset: number,
): string | null {
  if (!Number.isFinite(offset) || offset < 0) {
    return null
  }

  return Object.entries(sourceLocations)
    .filter(([, location]) => offset >= location.range.start && offset < location.range.end)
    .sort(([, left], [, right]) =>
      (left.range.end - left.range.start) - (right.range.end - right.range.start),
    )[0]?.[0] ?? null
}

interface ProjectionContext {
  diagnostics: string[]
  nodes: Record<string, UIEditorNode>
  previousByPath: Map<string, UIEditorNode>
  previewContext: SFCVueRenderContext
  source: string
  sourceLocations: UIEditorSourceNodeLocations
}

const DOCUMENT_VERSION = 6
const DEFAULT_PAGE_ROW_HEIGHT = 28

export function projectUIEditorDocumentFromSFC(
  source: string,
  previousDocument?: UIEditorDocument,
): UIEditorSFCSourceProjection {
  const parsed = parseComponentSFC(source)
  const compiled = compileComponentSFC(source)
  const parserErrors = parsed.diagnostics
    .filter(diagnostic => diagnostic.severity === 'error')
    .map(diagnostic => diagnostic.message)

  if (!parsed.ast?.template || parserErrors.length > 0) {
    return {
      document: null,
      diagnostics: parserErrors.length > 0 ? parserErrors : ['SFC source должен содержать корректный <template>.'],
      sourceLocations: {},
    }
  }

  const roots = semanticChildren(parsed.ast.template.roots)
  if (roots.length !== 1 || roots[0]?.kind !== 'element') {
    return {
      document: null,
      diagnostics: ['Visual editor поддерживает ровно один корневой элемент template.'],
      sourceLocations: {},
    }
  }
  if (roots[0].tag !== 'Flex' && roots[0].tag !== 'Grid') {
    return {
      document: null,
      diagnostics: ['Корневым элементом visual editor должен быть <Flex> или <Grid>.'],
      sourceLocations: {},
    }
  }

  const context: ProjectionContext = {
    diagnostics: [],
    nodes: {},
    previousByPath: indexDocumentByPath(previousDocument),
    previewContext: createPreviewRenderContext(compiled.previewProps),
    source,
    sourceLocations: {},
  }
  const root = projectElement(roots[0], '0', context, true)

  if (!root || context.diagnostics.length > 0) {
    return {
      document: null,
      diagnostics: context.diagnostics,
      sourceLocations: {},
    }
  }

  return {
    document: {
      id: previousDocument?.id ?? 'ui-editor-demo-document',
      version: DOCUMENT_VERSION,
      rootId: root.id,
      nodes: context.nodes,
    },
    diagnostics: [],
    sourceLocations: context.sourceLocations,
  }
}

export function patchUIEditorSFCTemplate(source: string, document: UIEditorDocument): string {
  const parsed = parseComponentSFC(source)
  const range = parsed.ast?.template?.range
  if (!range || parsed.diagnostics.some(diagnostic => diagnostic.severity === 'error')) {
    return printUIEditorDocumentSFC(document)
  }

  const template = `\n${printUIEditorDocumentTemplate(document)}\n`
  return `${source.slice(0, range.start)}${template}${source.slice(range.end)}`
}

function projectElement(
  ast: RComponentSFC_AST_ElementNode,
  path: string,
  context: ProjectionContext,
  isRoot: boolean,
  suggestedRowStart = 1,
  parentTag: string | null = null,
): UIEditorNode | null {
  const direction = readAttribute(ast.attributes, 'direction') ?? 'row'
  const contract = isRoot
    ? null
    : resolveContract(ast.tag, direction)

  if (!isRoot && !contract) {
    context.diagnostics.push(`Тег <${ast.tag}> пока не поддерживается visual editor.`)
    return null
  }
  if (ast.directives.length > 0) {
    context.diagnostics.push(`<${ast.tag}> содержит directive, недоступную visual editor.`)
    return null
  }

  const allowedAttributes = ast.tag === 'Flex'
    ? new Set(['direction', 'gap', 'p', 'align', 'justify', 'wrap'])
    : ast.tag === 'Grid'
      ? new Set(['columns', 'gap', 'p', 'autoRows'])
      : ast.tag === 'Box'
        ? new Set(['p'])
        : new Set<string>()
  if (parentTag === 'Grid') {
    allowedAttributes.add('colStart')
    allowedAttributes.add('colSpan')
    allowedAttributes.add('rowStart')
    allowedAttributes.add('rowSpan')
  }
  const dynamicAttributes = new Set(contract?.dynamicAttributes ?? [])
  const unsupportedDynamicAttribute = ast.attributes.find(
    attribute => attribute.dynamic && !dynamicAttributes.has(attribute.name),
  )
  if (unsupportedDynamicAttribute) {
    context.diagnostics.push(
      `<${ast.tag}> содержит dynamic binding :${unsupportedDynamicAttribute.name}, недоступную visual editor.`,
    )
    return null
  }
  const unsupportedAttribute = ast.attributes.find(
    attribute => !attribute.dynamic && !allowedAttributes.has(attribute.name),
  )
  if (unsupportedAttribute) {
    context.diagnostics.push(`Атрибут "${unsupportedAttribute.name}" тега <${ast.tag}> пока не поддерживается visual editor.`)
    return null
  }

  const previous = context.previousByPath.get(path)
  const canReusePrevious = previous && nodeTag(previous) === ast.tag
  const id = canReusePrevious
    ? previous.id
    : isRoot ? 'ui-page-root' : createSourceNodeId()
  context.sourceLocations[id] = {
    range: { ...ast.range },
    openingTagRange: getOpeningTagRange(context.source, ast),
  }
  const layout = isRoot
    ? undefined
    : parentTag === 'Grid'
      ? readGridPlacement(ast.attributes, contract?.defaultLayout ?? defaultLayout(), suggestedRowStart)
      : {
          ...(contract?.defaultLayout ?? defaultLayout()),
          colStart: 1,
          rowStart: 1,
        }

  const node = isRoot
    ? createPageNode(id, ast)
    : createContractNode(id, ast, contract!, layout!)
  context.nodes[id] = node

  const attributeBindings = projectAttributeBindings(ast.attributes, context)
  if (attributeBindings.length > 0) {
    node.meta = {
      ...(node.meta ?? {}),
      [UI_EDITOR_SFC_ATTRIBUTE_BINDINGS_META_KEY]: attributeBindings,
    }
  }

  if (ast.tag === 'Text') {
    const textContent = readTextContent(ast.tag, ast.children, context)
    if (!textContent) {
      return null
    }
    if (node.kind === 'text') {
      node.props.text = textContent.preview
      if (textContent.segments.some(segment => segment.kind === 'expression')) {
        node.meta = {
          ...(node.meta ?? {}),
          [UI_EDITOR_SFC_TEXT_SEGMENTS_META_KEY]: textContent.segments,
        }
      }
    }
    return node
  }

  if (ast.tag === 'Badge') {
    const content = readTextContent(ast.tag, ast.children, context)
    if (!content) {
      return null
    }
    node.meta = {
      ...(node.meta ?? {}),
      [UI_EDITOR_SFC_CONTENT_PREVIEW_META_KEY]: content.preview,
      ...(content.segments.some(segment => segment.kind === 'expression')
        ? { [UI_EDITOR_SFC_TEXT_SEGMENTS_META_KEY]: content.segments }
        : {}),
    }
    return node
  }

  const children = semanticChildren(ast.children)
  if (contract && !contract.supportsChildren && children.length > 0) {
    context.diagnostics.push(`Тег <${ast.tag}> не поддерживает дочерние элементы в visual editor.`)
    return null
  }

  let nextPageRow = 1
  for (const [index, child] of children.entries()) {
    if (child.kind !== 'element') {
      context.diagnostics.push(`Внутри <${ast.tag}> поддерживаются только статические element-узлы.`)
      continue
    }
    const childNode = projectElement(
      child,
      `${path}.${index}`,
      context,
      false,
      ast.tag === 'Grid' ? nextPageRow : 1,
      ast.tag,
    )
    if (!childNode) {
      continue
    }
    node.children.push(childNode.id)
    if (ast.tag === 'Grid' && childNode.layout) {
      nextPageRow = childNode.layout.rowStart + childNode.layout.rowSpan
    }
  }

  return node
}

function getOpeningTagRange(
  source: string,
  node: RComponentSFC_AST_ElementNode,
): RComponentSFC_AST_ElementNode['range'] {
  let quote: '"' | '\'' | null = null
  for (let offset = node.range.start; offset < node.range.end; offset += 1) {
    const character = source[offset]
    if ((character === '"' || character === '\'') && source[offset - 1] !== '\\') {
      quote = quote === character ? null : quote ?? character
      continue
    }
    if (character === '>' && quote == null) {
      return {
        start: node.range.start,
        end: offset + 1,
        startLine: node.range.startLine,
        startColumn: node.range.startColumn,
      }
    }
  }
  return { ...node.range }
}

function createPageNode(id: string, ast: RComponentSFC_AST_ElementNode): UIEditorNode {
  const layoutMode = ast.tag === 'Grid' ? 'grid' : 'flex'
  return {
    id,
    kind: 'page',
    definitionRef: 'ui.page',
    configRef: null,
    assetRef: null,
    name: 'Page',
    children: [],
    props: {
      title: 'SFC Page',
      layoutMode,
      direction: readAttribute(ast.attributes, 'direction') === 'column' ? 'column' : 'row',
      align: readAttribute(ast.attributes, 'align'),
      justify: readAttribute(ast.attributes, 'justify'),
      wrap: readBooleanAttribute(ast.attributes, 'wrap'),
      columns: layoutMode === 'grid' ? readNumberAttribute(ast.attributes, 'columns', 12) : 12,
      gap: readPixelAttribute(ast.attributes, 'gap', 10),
      padding: readPixelAttribute(ast.attributes, 'p', 10),
      rowHeight: layoutMode === 'grid'
        ? readPixelAttribute(ast.attributes, 'autoRows', DEFAULT_PAGE_ROW_HEIGHT)
        : DEFAULT_PAGE_ROW_HEIGHT,
    },
  } as unknown as UIEditorNode
}

function createContractNode(
  id: string,
  ast: RComponentSFC_AST_ElementNode,
  contract: (typeof UI_EDITOR_SFC_DEFINITION_CONTRACTS)[number],
  layout: UIEditorNodeLayout,
): UIEditorNode {
  const props = { ...contract.defaultProps }
  if (contract.kind === 'flex') {
    Object.assign(props, {
      direction: readAttribute(ast.attributes, 'direction') === 'column' ? 'column' : 'row',
      align: readAttribute(ast.attributes, 'align'),
      justify: readAttribute(ast.attributes, 'justify'),
      wrap: readBooleanAttribute(ast.attributes, 'wrap'),
      gap: readPixelAttribute(ast.attributes, 'gap', Number(props.gap ?? 8)),
      padding: readPixelAttribute(ast.attributes, 'p', Number(props.padding ?? 8)),
    })
  }
  if (contract.kind === 'box') {
    Object.assign(props, {
      padding: readPixelAttribute(ast.attributes, 'p', Number(props.padding ?? 8)),
    })
  }
  if (contract.kind === 'grid') {
    Object.assign(props, {
      columns: readNumberAttribute(ast.attributes, 'columns', Number(props.columns ?? 12)),
      gap: readPixelAttribute(ast.attributes, 'gap', Number(props.gap ?? 8)),
      padding: readPixelAttribute(ast.attributes, 'p', Number(props.padding ?? 8)),
      rowHeight: readPixelAttribute(ast.attributes, 'autoRows', Number(props.rowHeight ?? DEFAULT_PAGE_ROW_HEIGHT)),
    })
  }

  return {
    id,
    kind: contract.kind,
    definitionRef: contract.definitionRef,
    configRef: null,
    assetRef: null,
    name: contract.label,
    children: [],
    props,
    layout,
  } as unknown as UIEditorNode
}

function resolveContract(tag: string, direction: string) {
  if (tag === 'Flex') {
    return getUIEditorSFCDefinitionContract(direction === 'row' ? 'ui.inline' : 'ui.stack')
  }
  return UI_EDITOR_SFC_DEFINITION_CONTRACTS.find(contract => contract.tag === tag) ?? null
}

function readTextContent(
  tag: string,
  children: RComponentSFC_AST_TemplateNode[],
  context: ProjectionContext,
): { preview: string, segments: UIEditorSFCTextSegment[] } | null {
  if (children.some(child => child.kind === 'element')) {
    context.diagnostics.push(`<${tag}> поддерживает только текст и interpolation без вложенных элементов.`)
    return null
  }

  const segments = children.map<UIEditorSFCTextSegment>((child) => {
    if (child.kind === 'interpolation') {
      return { kind: 'expression', expression: child.expression.trim() }
    }
    return { kind: 'text', value: child.kind === 'text' ? child.content : '' }
  })
  trimTextSegmentEdges(segments)
  const normalizedSegments = segments.filter(segment => segment.kind === 'expression' || segment.value.length > 0)
  const preview = normalizedSegments.map((segment) => {
    if (segment.kind === 'text') {
      return segment.value
    }
    const value = evaluateSFCExpression(segment.expression, context.previewContext)
    return value === undefined
      ? `{{ ${segment.expression} }}`
      : formatPreviewValue(value)
  }).join('')

  return { preview, segments: normalizedSegments }
}

function projectAttributeBindings(
  attributes: RComponentSFC_AST_Attribute[],
  context: ProjectionContext,
): UIEditorSFCAttributeBinding[] {
  return attributes
    .filter(attribute => attribute.dynamic)
    .map((attribute) => {
      const expression = (attribute.value ?? '').trim()
      const previewValue = evaluateSFCExpression(expression, context.previewContext)
      return {
        name: attribute.name,
        expression,
        resolved: previewValue !== undefined,
        ...(previewValue !== undefined ? { previewValue } : {}),
      }
    })
}

function trimTextSegmentEdges(segments: UIEditorSFCTextSegment[]): void {
  const first = segments[0]
  if (first?.kind === 'text') {
    first.value = first.value.trimStart()
  }
  const last = segments[segments.length - 1]
  if (last?.kind === 'text') {
    last.value = last.value.trimEnd()
  }
}

function formatPreviewValue(value: unknown): string {
  if (value == null) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    }
    catch {
      return String(value)
    }
  }
  return String(value)
}

function createPreviewRenderContext(previewProps: ComponentSFCPreviewProps | null): SFCVueRenderContext {
  return {
    props: materializeLiteralPreviewProps(previewProps),
    locals: {},
    iteration: null,
    renderVersion: 0,
    host: null,
    runtimeState: null,
    componentStack: [],
    consumerScope: 'ui-editor-preview',
    styleArtifacts: [],
    styleParent: undefined,
    styleSiblings: [],
    styleSiblingCount: 0,
    styleOwnerScopeId: undefined,
    runtimeScopeIds: [],
  }
}

function materializeLiteralPreviewProps(previewProps: ComponentSFCPreviewProps | null): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(previewProps ?? {}).filter(([, value]) => !isPreviewRuntimeReference(value)),
  )
}

function isPreviewRuntimeReference(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const type = (value as { type?: unknown }).type
  return type === 'store' || type === 'data'
}

function semanticChildren(nodes: RComponentSFC_AST_TemplateNode[]): RComponentSFC_AST_TemplateNode[] {
  return nodes.filter(node => node.kind !== 'text' || node.content.trim().length > 0)
}

function readAttribute(attributes: RComponentSFC_AST_Attribute[], name: string): string | null {
  return attributes.find(attribute => attribute.name === name)?.value ?? null
}

function readBooleanAttribute(attributes: RComponentSFC_AST_Attribute[], name: string): boolean {
  const attribute = attributes.find(candidate => candidate.name === name)
  if (!attribute) {
    return false
  }
  return attribute.value === null || attribute.value === '' || attribute.value === 'true'
}

function readPixelAttribute(
  attributes: RComponentSFC_AST_Attribute[],
  name: string,
  fallback: number,
): number {
  const raw = readAttribute(attributes, name)
  if (!raw) {
    return fallback
  }
  const numeric = Number(raw.replace(/px$/i, ''))
  return Number.isFinite(numeric) ? numeric : fallback
}

function readNumberAttribute(
  attributes: RComponentSFC_AST_Attribute[],
  name: string,
  fallback: number,
): number {
  const raw = readAttribute(attributes, name)
  if (raw == null || raw.trim() === '') {
    return fallback
  }
  const numeric = Number(raw)
  return Number.isFinite(numeric) ? numeric : fallback
}

function readGridPlacement(
  attributes: RComponentSFC_AST_Attribute[],
  fallback: UIEditorNodeLayout,
  suggestedRowStart: number,
): UIEditorNodeLayout {
  const colSpan = Math.max(1, Math.min(12, readNumberAttribute(attributes, 'colSpan', fallback.span)))
  const colStart = Math.max(1, Math.min(Math.max(1, 13 - colSpan), readNumberAttribute(attributes, 'colStart', fallback.colStart)))
  return {
    colStart,
    rowStart: Math.max(1, readNumberAttribute(attributes, 'rowStart', suggestedRowStart)),
    span: colSpan,
    rowSpan: Math.max(1, Math.min(40, readNumberAttribute(attributes, 'rowSpan', fallback.rowSpan))),
  }
}

function nodeTag(node: UIEditorNode): string | null {
  if (node.kind === 'page') {
    return node.props.layoutMode === 'grid' ? 'Grid' : 'Flex'
  }
  return getUIEditorSFCDefinitionContract(node.definitionRef)?.tag ?? null
}

function indexDocumentByPath(document?: UIEditorDocument): Map<string, UIEditorNode> {
  const result = new Map<string, UIEditorNode>()
  if (!document) {
    return result
  }

  const visit = (nodeId: string, path: string): void => {
    const node = document.nodes[nodeId]
    if (!node) {
      return
    }
    result.set(path, node)
    node.children.forEach((childId, index) => visit(childId, `${path}.${index}`))
  }
  visit(document.rootId, '0')
  return result
}

function defaultLayout(): UIEditorNodeLayout {
  return { colStart: 1, rowStart: 1, span: 12, rowSpan: 2 }
}

function createSourceNodeId(): string {
  return `ui-node-${Math.random().toString(36).slice(2, 10)}`
}
