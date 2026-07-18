import type { UIEditorDocument, UIEditorNode, UIEditorNodeLayout } from '@/features/endge-admin-ui-editor/types'
import type {
  RComponentSFC_AST_Attribute,
  RComponentSFC_AST_ElementNode,
  RComponentSFC_AST_TemplateNode,
} from '@endge/core'

import { parseComponentSFC } from '@endge/core'

import { printUIEditorDocumentSFC, printUIEditorDocumentTemplate } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-jsx'
import {
  getUIEditorSFCDefinitionContract,
  UI_EDITOR_SFC_DEFINITION_CONTRACTS,
} from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-contract'

export interface UIEditorSFCSourceProjection {
  document: UIEditorDocument | null
  diagnostics: string[]
}

interface ProjectionContext {
  diagnostics: string[]
  nodes: Record<string, UIEditorNode>
  previousByPath: Map<string, UIEditorNode>
}

const DOCUMENT_VERSION = 6
const DEFAULT_PAGE_ROW_HEIGHT = 28

export function projectUIEditorDocumentFromSFC(
  source: string,
  previousDocument?: UIEditorDocument,
): UIEditorSFCSourceProjection {
  const parsed = parseComponentSFC(source)
  const parserErrors = parsed.diagnostics
    .filter(diagnostic => diagnostic.severity === 'error')
    .map(diagnostic => diagnostic.message)

  if (!parsed.ast?.template || parserErrors.length > 0) {
    return {
      document: null,
      diagnostics: parserErrors.length > 0 ? parserErrors : ['SFC source должен содержать корректный <template>.'],
    }
  }

  const roots = semanticChildren(parsed.ast.template.roots)
  if (roots.length !== 1 || roots[0]?.kind !== 'element') {
    return {
      document: null,
      diagnostics: ['Visual editor поддерживает ровно один корневой элемент template.'],
    }
  }
  if (roots[0].tag !== 'Flex') {
    return {
      document: null,
      diagnostics: ['Корневым элементом visual editor должен быть <Flex>.'],
    }
  }

  const context: ProjectionContext = {
    diagnostics: [],
    nodes: {},
    previousByPath: indexDocumentByPath(previousDocument),
  }
  const root = projectElement(roots[0], '0', context, true)

  if (!root || context.diagnostics.length > 0) {
    return {
      document: null,
      diagnostics: context.diagnostics,
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
): UIEditorNode | null {
  const direction = readAttribute(ast.attributes, 'direction') ?? 'column'
  const contract = isRoot
    ? null
    : resolveContract(ast.tag, direction)

  if (!isRoot && !contract) {
    context.diagnostics.push(`Тег <${ast.tag}> пока не поддерживается visual editor.`)
    return null
  }
  if (ast.directives.length > 0 || ast.attributes.some(attribute => attribute.dynamic)) {
    context.diagnostics.push(`<${ast.tag}> содержит dynamic binding или directive, недоступную visual editor.`)
    return null
  }

  const allowedAttributes = isRoot || ast.tag === 'Flex'
    ? new Set(['direction', 'gap', 'p'])
    : ast.tag === 'Box'
      ? new Set(['p'])
      : new Set<string>()
  const unsupportedAttribute = ast.attributes.find(attribute => !allowedAttributes.has(attribute.name))
  if (unsupportedAttribute) {
    context.diagnostics.push(`Атрибут "${unsupportedAttribute.name}" тега <${ast.tag}> пока не поддерживается visual editor.`)
    return null
  }

  const previous = context.previousByPath.get(path)
  const canReusePrevious = previous && nodeTag(previous) === ast.tag
  const id = canReusePrevious
    ? previous.id
    : isRoot ? 'ui-page-root' : createSourceNodeId()
  const layout = isRoot
    ? undefined
    : previous?.layout
      ? { ...previous.layout }
      : {
          ...(contract?.defaultLayout ?? defaultLayout()),
          rowStart: suggestedRowStart,
        }

  const node = isRoot
    ? createPageNode(id, ast)
    : createContractNode(id, ast, contract!, layout!)
  context.nodes[id] = node

  if (ast.tag === 'Text') {
    const text = readStaticText(ast.children, context)
    if (text == null) {
      return null
    }
    if (node.kind === 'text') {
      node.props.text = text
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
      isRoot ? nextPageRow : 1,
    )
    if (!childNode) {
      continue
    }
    node.children.push(childNode.id)
    if (isRoot && childNode.layout) {
      nextPageRow = childNode.layout.rowStart + childNode.layout.rowSpan
    }
  }

  return node
}

function createPageNode(id: string, ast: RComponentSFC_AST_ElementNode): UIEditorNode {
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
      gap: readPixelAttribute(ast.attributes, 'gap', 10),
      padding: readPixelAttribute(ast.attributes, 'p', 10),
      rowHeight: DEFAULT_PAGE_ROW_HEIGHT,
    },
  } as UIEditorNode
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
      direction: readAttribute(ast.attributes, 'direction') === 'row' ? 'row' : 'column',
      gap: readPixelAttribute(ast.attributes, 'gap', Number(props.gap ?? 8)),
      padding: readPixelAttribute(ast.attributes, 'p', Number(props.padding ?? 8)),
    })
  }
  if (contract.kind === 'box') {
    Object.assign(props, {
      padding: readPixelAttribute(ast.attributes, 'p', Number(props.padding ?? 8)),
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
  } as UIEditorNode
}

function resolveContract(tag: string, direction: string) {
  if (tag === 'Flex') {
    return getUIEditorSFCDefinitionContract(direction === 'row' ? 'ui.inline' : 'ui.stack')
  }
  return UI_EDITOR_SFC_DEFINITION_CONTRACTS.find(contract => contract.tag === tag) ?? null
}

function readStaticText(
  children: RComponentSFC_AST_TemplateNode[],
  context: ProjectionContext,
): string | null {
  if (children.some(child => child.kind !== 'text')) {
    context.diagnostics.push('<Text> поддерживает только статический текст без interpolation.')
    return null
  }
  return children.map(child => child.kind === 'text' ? child.content : '').join('').trim()
}

function semanticChildren(nodes: RComponentSFC_AST_TemplateNode[]): RComponentSFC_AST_TemplateNode[] {
  return nodes.filter(node => node.kind !== 'text' || node.content.trim().length > 0)
}

function readAttribute(attributes: RComponentSFC_AST_Attribute[], name: string): string | null {
  return attributes.find(attribute => attribute.name === name)?.value ?? null
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

function nodeTag(node: UIEditorNode): string | null {
  if (node.kind === 'page') {
    return 'Flex'
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
