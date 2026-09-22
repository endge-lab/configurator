import type { RuntimePreviewTreeNode } from '@/features/endge-ide/domain/types/runtime-preview.types'

import { Endge } from '@endge/core'

const STATE_KEY = 'configurator.runtime-preview.tree-view'

export type RuntimeTreeExpansionPreset
  = | 'collapsed'
    | 'root-content'
    | 'expanded'

export interface RuntimeTreeViewEntry {
  key: string
  tree: readonly RuntimePreviewTreeNode[]
}

interface RuntimeTreeExpansionOptions {
  includeGroups?: boolean
}

interface PersistedRuntimeTreeViewState {
  version: 1
  structure: string
  expanded: string[]
}

export function runtimeTreeNodeExpansionKey(
  entryKey: string,
  nodeId: string,
): string {
  return JSON.stringify([entryKey, nodeId])
}

export function createRuntimeTreeStructure(
  entries: readonly RuntimeTreeViewEntry[],
): string {
  if (entries.length === 0) {
    return ''
  }
  const structure: string[] = []
  for (const entry of entries) {
    structure.push(JSON.stringify(['entry', entry.key]))
    for (const node of entry.tree) {
      appendNodeStructure(structure, entry.key, node, 0)
    }
  }
  return JSON.stringify(structure)
}

export function collectRuntimeTreeExpansion(
  entries: readonly RuntimeTreeViewEntry[],
  preset: RuntimeTreeExpansionPreset,
  options: RuntimeTreeExpansionOptions = {},
): Set<string> {
  const expanded = new Set<string>()
  for (const entry of entries) {
    for (const node of entry.tree) {
      collectNodeExpansion(expanded, entry.key, node, preset, options)
    }
  }
  return expanded
}

export function readRuntimeTreeViewState(
  storageKey = runtimeTreeViewStorageKey(),
): { structure: string, expanded: Set<string> } | null {
  try {
    const value = Endge.context.getState<unknown>(storageKey)
    const parsed = parseRuntimeTreeViewState(value)
    return parsed
      ? { structure: parsed.structure, expanded: new Set(parsed.expanded) }
      : null
  }
  catch {
    return null
  }
}

export function writeRuntimeTreeViewState(
  structure: string,
  expanded: ReadonlySet<string>,
  storageKey = runtimeTreeViewStorageKey(),
): void {
  if (!structure) {
    return
  }
  try {
    const payload: PersistedRuntimeTreeViewState = {
      version: 1,
      structure,
      expanded: [...expanded].sort(),
    }
    Endge.context.setState(storageKey, payload)
  }
  catch {
    // Runtime Tree сохраняет работоспособность, когда browser storage недоступен.
  }
}

export function runtimeTreeViewStorageKey(): string {
  return STATE_KEY
}

function appendNodeStructure(
  structure: string[],
  entryKey: string,
  node: RuntimePreviewTreeNode,
  depth: number,
): void {
  structure.push(
    JSON.stringify([
      runtimeTreeNodeExpansionKey(entryKey, node.id),
      node.kind,
      node.entityType,
      node.identity,
      depth,
      node.children.length,
    ]),
  )
  for (const child of node.children) {
    appendNodeStructure(structure, entryKey, child, depth + 1)
  }
}

function collectNodeExpansion(
  expanded: Set<string>,
  entryKey: string,
  node: RuntimePreviewTreeNode,
  preset: RuntimeTreeExpansionPreset,
  options: RuntimeTreeExpansionOptions,
): void {
  if (node.children.length > 0 && shouldExpandNode(node, preset, options)) {
    expanded.add(runtimeTreeNodeExpansionKey(entryKey, node.id))
  }
  for (const child of node.children) {
    collectNodeExpansion(expanded, entryKey, child, preset, options)
  }
}

function shouldExpandNode(
  node: RuntimePreviewTreeNode,
  preset: RuntimeTreeExpansionPreset,
  options: RuntimeTreeExpansionOptions,
): boolean {
  if (node.kind === 'group' && options.includeGroups === false) {
    return false
  }
  if (preset === 'expanded') {
    return true
  }
  if (preset === 'collapsed') {
    return false
  }
  return (
    node.kind === 'simulation'
    || (node.kind === 'composition' && node.parentId == null)
  )
}

function parseRuntimeTreeViewState(
  value: unknown,
): PersistedRuntimeTreeViewState | null {
  if (
    !isRecord(value)
    || value.version !== 1
    || typeof value.structure !== 'string'
    || !Array.isArray(value.expanded)
    || value.expanded.some(item => typeof item !== 'string')
  ) {
    return null
  }
  return {
    version: 1,
    structure: value.structure,
    expanded: [...new Set(value.expanded as string[])],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
