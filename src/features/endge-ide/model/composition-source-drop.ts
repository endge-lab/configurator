/* eslint-disable style/max-statements-per-line */
import type {
  CompositionSourceDocument,
  CompositionSourcePatchOperation,
} from '@endge/core'

import { ComponentType, DomainSectionType } from '@endge/core'

export interface CompositionDropPayloadItem {
  kind?: string
  identity?: string
  sectionType?: string
  docType?: string
}

export type CompositionDropDescriptor
  = | { target: 'data', kind: 'store' | 'vocab', fallbackName: string, skipDuplicate: true }
    | { target: 'resources', kind: 'style' | 'i18n', fallbackName: string, skipDuplicate: true }
    | { target: 'runtimes', kind: 'filter' | 'query' | 'component' | 'composition', fallbackName: string, skipDuplicate: false }

export interface CompositionDropPlan {
  operations: CompositionSourcePatchOperation[]
  duplicateCount: number
  unsupportedCount: number
}

/** Сопоставляет persisted document с поддерживаемым Composition dependency slot. */
export function resolveCompositionDropDescriptor(
  item: CompositionDropPayloadItem,
): CompositionDropDescriptor | null {
  if (item.kind === 'folder') { return null }

  const sectionType = String(item.sectionType ?? '')
  const docType = String(item.docType ?? '')

  if (sectionType === DomainSectionType.Style) { return { target: 'resources', kind: 'style', fallbackName: 'style', skipDuplicate: true } }
  if (sectionType === DomainSectionType.I18nBundles) { return { target: 'resources', kind: 'i18n', fallbackName: 'translations', skipDuplicate: true } }
  if (sectionType === DomainSectionType.Store) { return { target: 'data', kind: 'store', fallbackName: 'store', skipDuplicate: true } }
  if (sectionType === DomainSectionType.Vocabs) { return { target: 'data', kind: 'vocab', fallbackName: 'vocab', skipDuplicate: true } }
  if (sectionType === DomainSectionType.Composition) { return { target: 'runtimes', kind: 'composition', fallbackName: 'composition', skipDuplicate: false } }
  if (sectionType === DomainSectionType.Query) { return { target: 'runtimes', kind: 'query', fallbackName: 'query', skipDuplicate: false } }
  if (sectionType === DomainSectionType.Filters) { return { target: 'runtimes', kind: 'filter', fallbackName: 'filter', skipDuplicate: false } }
  if (sectionType === DomainSectionType.Component && docType === ComponentType.SFC) { return { target: 'runtimes', kind: 'component', fallbackName: 'component', skipDuplicate: false } }

  return null
}

/** Строит одну атомарную пачку source operations для всех dropped documents. */
export function buildCompositionDropPlan(
  items: CompositionDropPayloadItem[],
  document: CompositionSourceDocument,
): CompositionDropPlan {
  const operations: CompositionSourcePatchOperation[] = []
  const usedNames = {
    data: new Set(document.data.map(item => item.name)),
    resources: new Set(document.resources
      .filter(item => item.scopePath === 'scope_default')
      .map(item => item.name)),
    runtimes: new Set(document.runtimes
      .filter(item => item.scopePath === 'scope_default')
      .map(item => item.name)),
  }
  const existingDependencies = new Set([
    ...document.data.map(item => `data:${item.kind}:${item.identity}`),
    ...document.resources
      .filter(item => item.scopePath === 'scope_default')
      .map(item => `resources:${item.kind}:${item.identity}`),
  ])
  let duplicateCount = 0
  let unsupportedCount = 0

  for (const item of items) {
    const identity = String(item.identity ?? '').trim()
    const descriptor = resolveCompositionDropDescriptor(item)
    if (!descriptor || !identity) {
      unsupportedCount += 1
      continue
    }

    const dependencyKey = `${descriptor.target}:${descriptor.kind}:${identity}`
    if (descriptor.skipDuplicate && existingDependencies.has(dependencyKey)) {
      duplicateCount += 1
      continue
    }

    const name = createUniqueName(
      toSourceIdentifier(identity, descriptor.fallbackName),
      usedNames[descriptor.target],
    )

    if (descriptor.target === 'data') {
      operations.push({
        type: 'add-data',
        name,
        kind: descriptor.kind,
        identity,
      })
    }
    else if (descriptor.target === 'resources') {
      operations.push({
        type: 'add-resource',
        name,
        kind: descriptor.kind,
        identity,
      })
    }
    else {
      operations.push({
        type: 'add-runtime',
        name,
        kind: descriptor.kind,
        identity,
        activation: 'manual',
      })
    }

    usedNames[descriptor.target].add(name)
    if (descriptor.skipDuplicate) { existingDependencies.add(dependencyKey) }
  }

  return { operations, duplicateCount, unsupportedCount }
}

function toSourceIdentifier(identity: string, fallback: string): string {
  const words = identity
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .split(/[^A-Z\d$]+/i)
    .filter(Boolean)

  if (!words.length) { return fallback }

  const first = words[0]!
  const rest = words.slice(1)
  const identifier = [
    first.toLowerCase(),
    ...rest.map(word => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`),
  ].join('')

  return /^[A-Z_$]/i.test(identifier)
    ? identifier
    : `${fallback}${identifier.charAt(0).toUpperCase()}${identifier.slice(1)}`
}

function createUniqueName(preferredName: string, usedNames: Set<string>): string {
  if (!usedNames.has(preferredName)) { return preferredName }

  let suffix = 2
  while (usedNames.has(`${preferredName}${suffix}`)) { suffix += 1 }

  return `${preferredName}${suffix}`
}
