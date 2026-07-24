import type { RuntimePreviewTreeNode } from '@/features/endge-ide/domain/types/runtime-preview.types'

import { Endge } from '@endge/core'

const STORAGE_KEY_PREFIX = 'endge:runtime-tree:view:v1'

export type RuntimeTreeExpansionPreset
  = | 'collapsed'
    | 'project-compositions'
    | 'expanded'

export interface RuntimeTreeViewEntry {
  key: string
  tree: readonly RuntimePreviewTreeNode[]
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
): Set<string> {
  const expanded = new Set<string>()
  for (const entry of entries) {
    for (const node of entry.tree) {
      collectNodeExpansion(expanded, entry.key, node, null, preset)
    }
  }
  return expanded
}

export function readRuntimeTreeViewState(
  storageKey = runtimeTreeViewStorageKey(),
): { structure: string, expanded: Set<string> } | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return null
    }
    const parsed = parseRuntimeTreeViewState(JSON.parse(raw))
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
  if (typeof window === 'undefined' || !structure) {
    return
  }
  try {
    const payload: PersistedRuntimeTreeViewState = {
      version: 1,
      structure,
      expanded: [...expanded].sort(),
    }
    window.localStorage.setItem(storageKey, JSON.stringify(payload))
  }
  catch {
    // Runtime Tree remains usable when browser storage is unavailable.
  }
}

export function runtimeTreeViewStorageKey(): string {
  const workspace = Endge.context.getCurrentWorkspace() ?? 'detached'
  const context = Endge.context.getExecutionContext()
  return [
    STORAGE_KEY_PREFIX,
    workspace,
    context.tenantIdentity,
    context.projectIdentity,
    context.environmentIdentity,
  ]
    .map(value => encodeURIComponent(String(value ?? '')))
    .join(':')
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
  parentKind: RuntimePreviewTreeNode['kind'] | null,
  preset: RuntimeTreeExpansionPreset,
): void {
  if (node.children.length > 0 && shouldExpandNode(node, parentKind, preset)) {
    expanded.add(runtimeTreeNodeExpansionKey(entryKey, node.id))
  }
  for (const child of node.children) {
    collectNodeExpansion(expanded, entryKey, child, node.kind, preset)
  }
}

function shouldExpandNode(
  node: RuntimePreviewTreeNode,
  parentKind: RuntimePreviewTreeNode['kind'] | null,
  preset: RuntimeTreeExpansionPreset,
): boolean {
  if (preset === 'expanded') {
    return true
  }
  if (preset === 'collapsed') {
    return false
  }
  return (
    node.kind === 'project'
    || (node.kind === 'composition'
      && (parentKind === 'project' || node.parentId == null))
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
