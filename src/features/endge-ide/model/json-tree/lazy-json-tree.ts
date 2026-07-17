/* eslint-disable style/max-statements-per-line */

export type LazyJsonContainer = unknown[] | Record<string, unknown>

export interface LazyJsonValueNode {
  kind: 'value'
  key: string
  path: string
  value: unknown
  ancestors: readonly object[]
}

export interface LazyJsonRangeNode {
  kind: 'range'
  key: string
  path: string
  source: LazyJsonContainer
  start: number
  end: number
  keys?: readonly string[]
  ancestors: readonly object[]
}

export type LazyJsonNodeDescriptor = LazyJsonValueNode | LazyJsonRangeNode

export interface LazyJsonTreeOptions {
  eagerLimit: number
  pageSize: number
}

export const DEFAULT_JSON_TREE_EAGER_LIMIT = 100
export const DEFAULT_JSON_TREE_PAGE_SIZE = 100
export const DEFAULT_JSON_TREE_NODE_BUDGET = 2_000

export function isLazyJsonContainer(value: unknown): value is LazyJsonContainer {
  if (Array.isArray(value)) { return true }
  if (!value || typeof value !== 'object') { return false }
  return Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null
}

export function createLazyJsonChildren(
  node: LazyJsonNodeDescriptor,
  options: LazyJsonTreeOptions,
): LazyJsonNodeDescriptor[] {
  if (node.kind === 'range') { return createRangeChildren(node, options) }
  if (!isLazyJsonContainer(node.value)) { return [] }
  if (node.ancestors.includes(node.value)) { return [] }

  return createContainerChildren(
    node.value,
    node.path,
    [...node.ancestors, node.value],
    options,
  )
}

export function lazyJsonNodeValue(node: LazyJsonNodeDescriptor): unknown {
  return node.kind === 'value' ? node.value : node.source
}

export function shouldAutoExpandLazyJsonNode(
  node: LazyJsonNodeDescriptor,
  depth: number,
  initialDepth: number,
): boolean {
  return node.kind !== 'range' && depth < initialDepth
}

export function lazyJsonNodeSize(node: LazyJsonNodeDescriptor): number {
  if (node.kind === 'range') { return node.end - node.start }
  if (Array.isArray(node.value)) { return node.value.length }
  if (isLazyJsonContainer(node.value)) { return Object.keys(node.value).length }
  return 0
}

export function lazyJsonNodeSummary(node: LazyJsonNodeDescriptor): string {
  if (node.kind === 'range') { return `${node.end - node.start} items` }
  if (Array.isArray(node.value)) { return `Array(${node.value.length})` }
  if (isLazyJsonContainer(node.value)) { return `Object(${Object.keys(node.value).length})` }
  return formatLazyJsonScalar(node.value)
}

export function formatLazyJsonScalar(value: unknown): string {
  if (value === null) { return 'null' }
  if (value === undefined) { return 'undefined' }
  if (typeof value === 'string') { return JSON.stringify(value) }
  if (typeof value === 'bigint') { return `${value}n` }
  if (typeof value === 'function' || typeof value === 'symbol') { return String(value) }
  if (value instanceof Date) { return JSON.stringify(value.toISOString()) }
  if (typeof value === 'object') { return Object.prototype.toString.call(value) }
  return String(value)
}

export function lazyJsonValueTone(value: unknown): string {
  if (value === null || value === undefined) { return 'null' }
  if (typeof value === 'string' || value instanceof Date) { return 'string' }
  if (typeof value === 'number' || typeof value === 'bigint') { return 'number' }
  if (typeof value === 'boolean') { return 'boolean' }
  return 'other'
}

function createContainerChildren(
  source: LazyJsonContainer,
  path: string,
  ancestors: readonly object[],
  options: LazyJsonTreeOptions,
): LazyJsonNodeDescriptor[] {
  const eagerLimit = normalizePositiveInteger(options.eagerLimit, DEFAULT_JSON_TREE_EAGER_LIMIT)
  const pageSize = normalizePositiveInteger(options.pageSize, DEFAULT_JSON_TREE_PAGE_SIZE)

  if (Array.isArray(source)) {
    if (source.length <= eagerLimit) { return createArrayValueNodes(source, 0, source.length, path, ancestors) }
    return createArrayRangeNodes(source, 0, source.length, path, ancestors, eagerLimit, pageSize)
  }

  const keys = Object.keys(source)
  if (keys.length <= eagerLimit) { return createObjectValueNodes(source, keys, 0, keys.length, path, ancestors) }
  return createObjectRangeNodes(source, keys, 0, keys.length, path, ancestors, eagerLimit, pageSize)
}

function createRangeChildren(
  node: LazyJsonRangeNode,
  options: LazyJsonTreeOptions,
): LazyJsonNodeDescriptor[] {
  const eagerLimit = normalizePositiveInteger(options.eagerLimit, DEFAULT_JSON_TREE_EAGER_LIMIT)
  const pageSize = normalizePositiveInteger(options.pageSize, DEFAULT_JSON_TREE_PAGE_SIZE)
  const count = node.end - node.start

  if (Array.isArray(node.source)) {
    if (count <= eagerLimit) { return createArrayValueNodes(node.source, node.start, node.end, node.path, node.ancestors) }
    return createArrayRangeNodes(node.source, node.start, node.end, node.path, node.ancestors, eagerLimit, pageSize)
  }

  const keys = node.keys ?? Object.keys(node.source)
  if (count <= eagerLimit) { return createObjectValueNodes(node.source, keys, node.start, node.end, node.path, node.ancestors) }
  return createObjectRangeNodes(node.source, keys, node.start, node.end, node.path, node.ancestors, eagerLimit, pageSize)
}

function createArrayValueNodes(
  source: unknown[],
  start: number,
  end: number,
  parentPath: string,
  ancestors: readonly object[],
): LazyJsonValueNode[] {
  return Array.from({ length: end - start }, (_, offset) => {
    const index = start + offset
    return {
      kind: 'value',
      key: String(index),
      path: `${parentPath}[${index}]`,
      value: source[index],
      ancestors,
    }
  })
}

function createObjectValueNodes(
  source: Record<string, unknown>,
  keys: readonly string[],
  start: number,
  end: number,
  parentPath: string,
  ancestors: readonly object[],
): LazyJsonValueNode[] {
  return keys.slice(start, end).map(key => ({
    kind: 'value',
    key,
    path: appendObjectPath(parentPath, key),
    value: source[key],
    ancestors,
  }))
}

function createArrayRangeNodes(
  source: unknown[],
  start: number,
  end: number,
  parentPath: string,
  ancestors: readonly object[],
  eagerLimit: number,
  pageSize: number,
): LazyJsonRangeNode[] {
  const rangeSize = chooseRangeSize(end - start, eagerLimit, pageSize)
  const result: LazyJsonRangeNode[] = []
  for (let rangeStart = start; rangeStart < end; rangeStart += rangeSize) {
    const rangeEnd = Math.min(end, rangeStart + rangeSize)
    result.push({
      kind: 'range',
      key: `[${rangeStart}…${rangeEnd - 1}]`,
      path: `${parentPath}[${rangeStart}:${rangeEnd}]`,
      source,
      start: rangeStart,
      end: rangeEnd,
      ancestors,
    })
  }
  return result
}

function createObjectRangeNodes(
  source: Record<string, unknown>,
  keys: readonly string[],
  start: number,
  end: number,
  parentPath: string,
  ancestors: readonly object[],
  eagerLimit: number,
  pageSize: number,
): LazyJsonRangeNode[] {
  const rangeSize = chooseRangeSize(end - start, eagerLimit, pageSize)
  const result: LazyJsonRangeNode[] = []
  for (let rangeStart = start; rangeStart < end; rangeStart += rangeSize) {
    const rangeEnd = Math.min(end, rangeStart + rangeSize)
    result.push({
      kind: 'range',
      key: `{${rangeStart}…${rangeEnd - 1}}`,
      path: `${parentPath}{${rangeStart}:${rangeEnd}}`,
      source,
      start: rangeStart,
      end: rangeEnd,
      keys,
      ancestors,
    })
  }
  return result
}

function chooseRangeSize(count: number, eagerLimit: number, pageSize: number): number {
  if (count <= eagerLimit) { return count }
  const minimumForBoundedFanOut = Math.ceil(count / eagerLimit)
  return Math.max(pageSize, Math.ceil(minimumForBoundedFanOut / pageSize) * pageSize)
}

function appendObjectPath(parent: string, key: string): string {
  return /^[A-Z_$][\w$]*$/i.test(key)
    ? `${parent}.${key}`
    : `${parent}[${JSON.stringify(key)}]`
}

function normalizePositiveInteger(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}
