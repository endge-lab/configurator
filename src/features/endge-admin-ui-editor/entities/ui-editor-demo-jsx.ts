import type { UIEditorSFCBaseTag } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-contract'
import type { UIEditorDocument, UIEditorNode } from '@/features/endge-admin-ui-editor/types'

import {
  getUIEditorSFCAttributeBindings,
  getUIEditorSFCContentPreview,
  getUIEditorSFCOpaqueSource,
  getUIEditorSFCSourceAttributes,
  getUIEditorSFCSourceDirectives,
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

function sourceOwnedAttributes(
  node: UIEditorNode,
  managedNames: ReadonlySet<string>,
  managePlacement: boolean,
): string[] {
  const placementNames = new Set(['colStart', 'colSpan', 'rowStart', 'rowSpan'])
  return getUIEditorSFCSourceAttributes(node)
    .filter(attribute => attribute.dynamic || (
      !managedNames.has(attribute.name)
      && (!managePlacement || !placementNames.has(attribute.name))
    ))
    .map(attribute => attribute.raw.trim())
    .filter(Boolean)
}

function sourceOwnedDirectives(node: UIEditorNode): string[] {
  return getUIEditorSFCSourceDirectives(node)
    .map(directive => directive.raw.trim())
    .filter(Boolean)
}

function fallbackBindings(node: UIEditorNode): string[] {
  const sourceDynamicNames = new Set(
    getUIEditorSFCSourceAttributes(node)
      .filter(attribute => attribute.dynamic)
      .map(attribute => attribute.name),
  )
  return getUIEditorSFCAttributeBindings(node)
    .filter(binding => !sourceDynamicNames.has(binding.name))
    .map(binding => `:${binding.name}="${escapeAttributeExpression(binding.expression)}"`)
}

function hasDynamicSourceAttribute(node: UIEditorNode, ...names: string[]): boolean {
  const candidates = new Set(names)
  return getUIEditorSFCSourceAttributes(node)
    .some(attribute => attribute.dynamic && candidates.has(attribute.name))
}

function printAttributes(node: UIEditorNode, parentTag: UIEditorSFCBaseTag | null): string[] {
  const bindings = fallbackBindings(node)
  const managePlacement = parentTag === 'Grid'

  if (node.kind === 'page') {
    if (node.props.layoutMode === 'grid') {
      const managedNames = new Set(['columns', 'gap', 'p', 'autoRows'])
      return [
        hasDynamicSourceAttribute(node, 'columns') ? '' : `columns="${Math.max(1, Math.round(Number(node.props.columns) || 12))}"`,
        hasDynamicSourceAttribute(node, 'gap') ? '' : pixelAttribute('gap', node.props.gap),
        hasDynamicSourceAttribute(node, 'p') ? '' : pixelAttribute('p', node.props.padding),
        hasDynamicSourceAttribute(node, 'autoRows') ? '' : pixelAttribute('autoRows', node.props.rowHeight),
        ...sourceOwnedAttributes(node, managedNames, managePlacement),
        ...sourceOwnedDirectives(node),
      ].filter(Boolean).concat(bindings)
    }
    const managedNames = new Set(['direction', 'col', 'row', 'align', 'justify', 'wrap', 'gap', 'p'])
    return [
      hasDynamicSourceAttribute(node, 'direction', 'col', 'row') ? '' : `direction="${node.props.direction === 'column' ? 'column' : 'row'}"`,
      hasDynamicSourceAttribute(node, 'align') ? '' : optionalAttribute('align', node.props.align),
      hasDynamicSourceAttribute(node, 'justify') ? '' : optionalAttribute('justify', node.props.justify),
      hasDynamicSourceAttribute(node, 'wrap') ? '' : node.props.wrap === true ? 'wrap' : '',
      hasDynamicSourceAttribute(node, 'gap') ? '' : pixelAttribute('gap', node.props.gap),
      hasDynamicSourceAttribute(node, 'p') ? '' : pixelAttribute('p', node.props.padding),
      ...sourceOwnedAttributes(node, managedNames, managePlacement),
      ...sourceOwnedDirectives(node),
    ].filter(Boolean).concat(bindings)
  }

  if (node.kind === 'flex') {
    const managedNames = new Set(['direction', 'col', 'row', 'align', 'justify', 'wrap', 'gap', 'p'])
    return [
      hasDynamicSourceAttribute(node, 'direction', 'col', 'row') ? '' : `direction="${node.props.direction === 'column' ? 'column' : 'row'}"`,
      hasDynamicSourceAttribute(node, 'align') ? '' : optionalAttribute('align', node.props.align),
      hasDynamicSourceAttribute(node, 'justify') ? '' : optionalAttribute('justify', node.props.justify),
      hasDynamicSourceAttribute(node, 'wrap') ? '' : node.props.wrap === true ? 'wrap' : '',
      hasDynamicSourceAttribute(node, 'gap') ? '' : pixelAttribute('gap', node.props.gap),
      hasDynamicSourceAttribute(node, 'p') ? '' : pixelAttribute('p', node.props.padding),
      ...sourceOwnedAttributes(node, managedNames, managePlacement),
      ...sourceOwnedDirectives(node),
    ].filter(Boolean).concat(bindings)
  }

  if (node.kind === 'box') {
    const managedNames = new Set(['p'])
    return [
      hasDynamicSourceAttribute(node, 'p') ? '' : pixelAttribute('p', node.props.padding),
      ...sourceOwnedAttributes(node, managedNames, managePlacement),
      ...sourceOwnedDirectives(node),
    ].filter(Boolean).concat(bindings)
  }

  if (node.kind === 'grid') {
    const managedNames = new Set(['columns', 'gap', 'p', 'autoRows'])
    return [
      hasDynamicSourceAttribute(node, 'columns') ? '' : `columns="${Math.max(1, Math.round(Number(node.props.columns) || 12))}"`,
      hasDynamicSourceAttribute(node, 'gap') ? '' : pixelAttribute('gap', node.props.gap),
      hasDynamicSourceAttribute(node, 'p') ? '' : pixelAttribute('p', node.props.padding),
      hasDynamicSourceAttribute(node, 'autoRows') ? '' : pixelAttribute('autoRows', node.props.rowHeight),
      ...sourceOwnedAttributes(node, managedNames, managePlacement),
      ...sourceOwnedDirectives(node),
    ].filter(Boolean).concat(bindings)
  }

  return [
    ...sourceOwnedAttributes(node, new Set(), managePlacement),
    ...sourceOwnedDirectives(node),
    ...bindings,
  ]
}

function printPlacementAttributes(node: UIEditorNode, parentTag: UIEditorSFCBaseTag | null): string[] {
  if (parentTag !== 'Grid' || !node.layout) {
    return []
  }

  return [
    hasDynamicSourceAttribute(node, 'colStart') ? '' : `colStart="${node.layout.colStart}"`,
    hasDynamicSourceAttribute(node, 'colSpan') ? '' : `colSpan="${node.layout.span}"`,
    hasDynamicSourceAttribute(node, 'rowStart') ? '' : `rowStart="${node.layout.rowStart}"`,
    hasDynamicSourceAttribute(node, 'rowSpan') ? '' : `rowSpan="${node.layout.rowSpan}"`,
  ].filter(Boolean)
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
    ...printAttributes(node, parentTag),
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

  const opaqueSource = getUIEditorSFCOpaqueSource(node)
  if (opaqueSource) {
    return indentOpaqueSource(opaqueSource, depth)
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

function indentOpaqueSource(source: string, depth: number): string {
  const lines = source.trim().split('\n')
  const commonIndent = lines
    .filter(line => line.trim())
    .reduce((minimum, line) => Math.min(minimum, line.match(/^\s*/)?.[0].length ?? 0), Number.POSITIVE_INFINITY)
  const trimBy = Number.isFinite(commonIndent) ? commonIndent : 0
  return lines
    .map(line => `${indent(depth)}${line.slice(trimBy)}`.trimEnd())
    .join('\n')
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
