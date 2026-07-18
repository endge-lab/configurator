import type { UIEditorSFCBaseTag } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-contract'
import type { UIEditorDocument, UIEditorNode } from '@/features/endge-admin-ui-editor/types'

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

function pixelAttribute(name: string, value: unknown): string {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0
    ? `${name}="${numeric}px"`
    : ''
}

function printAttributes(node: UIEditorNode): string[] {
  if (node.kind === 'page') {
    return [
      'direction="column"',
      pixelAttribute('gap', node.props.gap),
      pixelAttribute('p', node.props.padding),
    ].filter(Boolean)
  }

  if (node.kind === 'flex') {
    return [
      `direction="${node.props.direction === 'row' ? 'row' : 'column'}"`,
      pixelAttribute('gap', node.props.gap),
      pixelAttribute('p', node.props.padding),
    ].filter(Boolean)
  }

  if (node.kind === 'box') {
    return [pixelAttribute('p', node.props.padding)].filter(Boolean)
  }

  return []
}

function printChildren(document: UIEditorDocument, node: UIEditorNode, depth: number): string[] {
  return node.children
    .map(childId => printNode(document, childId, depth))
    .filter(Boolean)
}

function printElement(
  document: UIEditorDocument,
  node: UIEditorNode,
  tag: UIEditorSFCBaseTag,
  depth: number,
): string {
  if (tag === 'Text') {
    const content = node.kind === 'text'
      ? node.props.text
      : node.kind === 'button'
        ? node.props.label
        : node.name
    return `${indent(depth)}<Text>${escapeText(content)}</Text>`
  }

  if (tag !== 'Box' && tag !== 'Flex') {
    return `${indent(depth)}<${tag} />`
  }

  const attrs = printAttributes(node)
  const openTag = `${indent(depth)}<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}`
  const children = printChildren(document, node, depth + 1)

  if (children.length === 0) {
    return `${openTag} />`
  }

  return [
    `${openTag}>`,
    ...children,
    `${indent(depth)}</${tag}>`,
  ].join('\n')
}

function printNode(document: UIEditorDocument, nodeId: string, depth: number): string {
  const node = document.nodes[nodeId]
  if (!node) {
    return ''
  }

  if (node.kind === 'page') {
    return printElement(document, node, 'Flex', depth)
  }

  const contract = getUIEditorSFCDefinitionContract(node.definitionRef)
  if (contract) {
    return printElement(document, node, contract.tag, depth)
  }

  const label = escapeComment(`${node.name || node.kind} · ${node.definitionRef}`)
  return `${indent(depth)}<!-- Unsupported legacy editor node: ${label} -->`
}

export function printUIEditorDocumentSFC(document: UIEditorDocument): string {
  const template = printNode(document, document.rootId, 1)

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

/** @deprecated Use printUIEditorDocumentSFC. */
export function printUIEditorDocumentJsx(document: UIEditorDocument): string {
  return printUIEditorDocumentSFC(document)
}
