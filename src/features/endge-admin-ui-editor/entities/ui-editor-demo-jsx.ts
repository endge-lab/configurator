import type { UIEditorDocument, UIEditorNode } from '@/features/endge-admin-ui-editor/types'

import { Endge, getUIJsxTagName } from '@endge/core'

function indent(depth: number): string {
  return '  '.repeat(depth)
}

function printAttributes(node: UIEditorNode): string[] {
  const layoutAttrs = node.kind === 'page'
    ? []
    : [
        node.layout?.colStart && node.layout.colStart !== 1 ? `colStart={${node.layout.colStart}}` : '',
        node.layout?.rowStart && node.layout.rowStart !== 1 ? `rowStart={${node.layout.rowStart}}` : '',
        node.layout?.span && node.layout.span !== 12 ? `span={${node.layout.span}}` : '',
        node.layout?.rowSpan ? `rowSpan={${node.layout.rowSpan}}` : '',
      ].filter(Boolean)

  const referenceAttrs = [
    node.configRef ? `configRef="${node.configRef}"` : '',
    node.assetRef ? `assetRef="${node.assetRef}"` : '',
  ].filter(Boolean)

  switch (node.kind) {
    case 'page':
      return [
        `title="${node.props.title}"`,
        `gap={${node.props.gap}}`,
        `padding={${node.props.padding}}`,
        `rowHeight={${node.props.rowHeight}}`,
        ...referenceAttrs,
      ]
    case 'flex':
      return [
        `direction="${node.props.direction}"`,
        `gap={${node.props.gap}}`,
        `padding={${node.props.padding}}`,
        ...referenceAttrs,
        ...layoutAttrs,
      ]
    case 'grid':
      return [
        `columns={${node.props.columns}}`,
        `gap={${node.props.gap}}`,
        `padding={${node.props.padding}}`,
        `minHeight={${node.props.minHeight}}`,
        ...referenceAttrs,
        ...layoutAttrs,
      ]
    case 'box':
      return [
        `title="${node.props.title}"`,
        `padding={${node.props.padding}}`,
        ...referenceAttrs,
        ...layoutAttrs,
      ]
    case 'custom-component':
      return [
        `title="${node.props.title}"`,
        node.props.rendererRef ? `rendererRef="${node.props.rendererRef}"` : '',
        ...referenceAttrs,
        ...layoutAttrs,
      ].filter(Boolean)
    case 'button':
      return [`label="${node.props.label}"`, ...referenceAttrs, ...layoutAttrs]
    case 'text':
      return [...referenceAttrs, ...layoutAttrs]
    default:
      return []
  }
}

function printNode(document: UIEditorDocument, nodeId: string, depth = 0): string {
  const node = document.nodes[nodeId]
  if (!node) {
    return ''
  }

  if (node.kind === 'text') {
    return `${indent(depth)}<Text>${node.props.text}</Text>`
  }

  const definition = Endge.uiRegistry.getDefinition(node.definitionRef)
  const tag = definition
    ? getUIJsxTagName(definition)
    : node.kind === 'page'
      ? 'Page'
      : node.kind === 'flex'
        ? 'Flex'
        : node.kind === 'grid'
          ? 'Grid'
          : node.kind === 'box'
            ? 'Box'
            : node.kind === 'custom-component'
              ? 'CustomComponent'
              : 'Button'

  const attrs = printAttributes(node)
  if (node.kind === 'button' || node.kind === 'custom-component') {
    return `${indent(depth)}<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''} />`
  }

  const children = node.children
    .map(childId => printNode(document, childId, depth + 1))
    .filter(Boolean)

  if (children.length === 0) {
    return `${indent(depth)}<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''} />`
  }

  return [
    `${indent(depth)}<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}>`,
    ...children,
    `${indent(depth)}</${tag}>`,
  ].join('\n')
}

export function printUIEditorDocumentJsx(document: UIEditorDocument): string {
  return printNode(document, document.rootId)
}
