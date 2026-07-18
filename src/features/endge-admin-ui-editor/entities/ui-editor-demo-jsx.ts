import type { UIEditorSFCBaseTag } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-contract'
import type { UIEditorDocument, UIEditorNode } from '@/features/endge-admin-ui-editor/types'

import {
  getUIEditorSFCAttributeBindings,
  getUIEditorSFCContentPreview,
  getUIEditorSFCTextSegments,
} from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-bindings'
import { getUIEditorSFCDefinitionContract } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-contract'

function indent(depth: number): string {
  return '  '.repeat(depth)
}

function escapeText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeComment(value: unknown): string {
  return String(value ?? '')
    .replace(/-{2,}/g, '—')
    .trim()
}

function escapeAttributeExpression(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function pixelAttribute(name: string, value: unknown): string {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0
    ? `${name}="${numeric}px"`
    : ''
}

function optionalAttribute(name: string, value: unknown): string {
  const normalized = String(value ?? '').trim()
  return normalized ? `${name}="${normalized}"` : ''
}

function printAttributes(node: UIEditorNode): string[] {
  const bindings = getUIEditorSFCAttributeBindings(node)
    .map(binding => `:${binding.name}="${escapeAttributeExpression(binding.expression)}"`)

  if (node.kind === 'page') {
    if (node.props.layoutMode === 'grid') {
      return [
        `columns="${Math.max(1, Math.round(Number(node.props.columns) || 12))}"`,
        pixelAttribute('gap', node.props.gap),
        pixelAttribute('p', node.props.padding),
        pixelAttribute('autoRows', node.props.rowHeight),
      ].filter(Boolean).concat(bindings)
    }
    return [
      `direction="${node.props.direction === 'column' ? 'column' : 'row'}"`,
      optionalAttribute('align', node.props.align),
      optionalAttribute('justify', node.props.justify),
      node.props.wrap === true ? 'wrap' : '',
      pixelAttribute('gap', node.props.gap),
      pixelAttribute('p', node.props.padding),
    ].filter(Boolean).concat(bindings)
  }

  if (node.kind === 'flex') {
    return [
      `direction="${node.props.direction === 'column' ? 'column' : 'row'}"`,
      optionalAttribute('align', node.props.align),
      optionalAttribute('justify', node.props.justify),
      node.props.wrap === true ? 'wrap' : '',
      pixelAttribute('gap', node.props.gap),
      pixelAttribute('p', node.props.padding),
    ].filter(Boolean).concat(bindings)
  }

  if (node.kind === 'box') {
    return [pixelAttribute('p', node.props.padding)].filter(Boolean).concat(bindings)
  }

  if (node.kind === 'grid') {
    return [
      `columns="${Math.max(1, Math.round(Number(node.props.columns) || 12))}"`,
      pixelAttribute('gap', node.props.gap),
      pixelAttribute('p', node.props.padding),
      pixelAttribute('autoRows', node.props.rowHeight),
    ].filter(Boolean).concat(bindings)
  }

  return bindings
}

function printPlacementAttributes(node: UIEditorNode, parentTag: UIEditorSFCBaseTag | null): string[] {
  if (parentTag !== 'Grid' || !node.layout) {
    return []
  }

  return [
    `colStart="${node.layout.colStart}"`,
    `colSpan="${node.layout.span}"`,
    `rowStart="${node.layout.rowStart}"`,
    `rowSpan="${node.layout.rowSpan}"`,
  ]
}

function printChildren(
  document: UIEditorDocument,
  node: UIEditorNode,
  depth: number,
  parentTag: UIEditorSFCBaseTag,
): string[] {
  return node.children
    .map(childId => printNode(document, childId, depth, parentTag))
    .filter(Boolean)
}

function printElement(
  document: UIEditorDocument,
  node: UIEditorNode,
  tag: UIEditorSFCBaseTag,
  depth: number,
  parentTag: UIEditorSFCBaseTag | null,
): string {
  const attrs = [
    ...printAttributes(node),
    ...printPlacementAttributes(node, parentTag),
  ]
  const serializedAttrs = attrs.length ? ` ${attrs.join(' ')}` : ''
  if (tag === 'Text' || tag === 'Badge') {
    const textSegments = getUIEditorSFCTextSegments(node)
    const content = textSegments.length > 0
      ? textSegments.map(segment => segment.kind === 'text'
          ? escapeText(segment.value)
          : `{{ ${segment.expression} }}`,
        ).join('')
      : escapeText(tag === 'Badge'
          ? getUIEditorSFCContentPreview(node) ?? node.name
          : node.kind === 'text'
            ? node.props.text
            : node.kind === 'button'
              ? node.props.label
              : node.name,
        )
    return `${indent(depth)}<${tag}${serializedAttrs}>${content}</${tag}>`
  }

  if (tag !== 'Box' && tag !== 'Flex' && tag !== 'Grid') {
    return `${indent(depth)}<${tag}${serializedAttrs} />`
  }

  const openTag = `${indent(depth)}<${tag}${serializedAttrs}`
  const children = printChildren(document, node, depth + 1, tag)

  if (children.length === 0) {
    return `${openTag} />`
  }

  return [
    `${openTag}>`,
    ...children,
    `${indent(depth)}</${tag}>`,
  ].join('\n')
}

function printNode(
  document: UIEditorDocument,
  nodeId: string,
  depth: number,
  parentTag: UIEditorSFCBaseTag | null = null,
): string {
  const node = document.nodes[nodeId]
  if (!node) {
    return ''
  }

  if (node.kind === 'page') {
    return printElement(document, node, node.props.layoutMode === 'grid' ? 'Grid' : 'Flex', depth, parentTag)
  }

  const contract = getUIEditorSFCDefinitionContract(node.definitionRef)
  if (contract) {
    return printElement(document, node, contract.tag, depth, parentTag)
  }

  const label = escapeComment(`${node.name || node.kind} · ${node.definitionRef}`)
  return `${indent(depth)}<!-- Unsupported legacy editor node: ${label} -->`
}

export function printUIEditorDocumentSFC(document: UIEditorDocument): string {
  const template = printUIEditorDocumentTemplate(document)

  return [
    '<script setup lang="ts">',
    '</script>',
    '',
    '<template>',
    template,
    '</template>',
    '',
  ].join('\n')
}

export function printUIEditorDocumentTemplate(document: UIEditorDocument): string {
  return printNode(document, document.rootId, 1)
}

/** @deprecated Use printUIEditorDocumentSFC. */
export function printUIEditorDocumentJsx(document: UIEditorDocument): string {
  return printUIEditorDocumentSFC(document)
}
