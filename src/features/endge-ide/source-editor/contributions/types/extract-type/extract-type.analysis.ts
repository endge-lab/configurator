import type { TypeScriptTypeDeclarationAnalysis } from '@endge/core'

import { analyzeTypeScriptTypeDeclarations, parseComponentSFC } from '@endge/core'

export type ExtractableSFCTypeDeclaration = TypeScriptTypeDeclarationAnalysis

export interface ExtractableSFCTypePlan {
  root: ExtractableSFCTypeDeclaration
  /** Local declarations ordered dependencies first. */
  declarations: ExtractableSFCTypeDeclaration[]
  unsupportedReason: string | null
}

/** Returns absolute SFC ranges for every top-level script type declaration. */
export function analyzeExtractableSFCTypeDeclarations(source: string): ExtractableSFCTypeDeclaration[] {
  const script = parseComponentSFC(source).ast?.script
  if (!script || script.lang !== 'ts') {
    return []
  }

  return analyzeTypeScriptTypeDeclarations(script.content).map(declaration => ({
    ...declaration,
    range: {
      start: script.range.start + declaration.range.start,
      end: script.range.start + declaration.range.end,
    },
    actionAnchor: script.range.start + declaration.actionAnchor,
  }))
}

/** Builds the complete local dependency closure for one declaration. */
export function resolveExtractableSFCTypePlan(
  source: string,
  declarationStart: number,
): ExtractableSFCTypePlan | null {
  return buildExtractableSFCTypePlan(analyzeExtractableSFCTypeDeclarations(source), declarationStart)
}

export function buildExtractableSFCTypePlan(
  declarations: readonly ExtractableSFCTypeDeclaration[],
  declarationStart: number,
): ExtractableSFCTypePlan | null {
  const root = declarations.find(declaration => declaration.range.start === declarationStart)
  if (!root) {
    return null
  }

  const byIdentity = new Map<string, ExtractableSFCTypeDeclaration>()
  const duplicateIdentities = new Set<string>()
  for (const declaration of declarations) {
    if (byIdentity.has(declaration.identity)) {
      duplicateIdentities.add(declaration.identity)
    }
    else {
      byIdentity.set(declaration.identity, declaration)
    }
  }

  const ordered: ExtractableSFCTypeDeclaration[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()
  let unsupportedReason: string | null = null

  const visit = (declaration: ExtractableSFCTypeDeclaration, path: string[]): void => {
    if (unsupportedReason || visited.has(declaration.identity)) {
      return
    }
    if (visiting.has(declaration.identity)) {
      unsupportedReason = `Циклическая локальная зависимость: ${[...path, declaration.identity].join(' → ')}.`
      return
    }
    if (duplicateIdentities.has(declaration.identity)) {
      unsupportedReason = `Локальный тип "${declaration.identity}" объявлен несколько раз.`
      return
    }
    if (!declaration.document || declaration.unsupportedReason) {
      unsupportedReason = declaration === root
        ? declaration.unsupportedReason ?? 'TypeScript declaration не поддерживается.'
        : `Зависимость "${declaration.identity}" нельзя выделить: ${declaration.unsupportedReason ?? 'unsupported TypeScript declaration'}`
      return
    }

    visiting.add(declaration.identity)
    for (const dependencyIdentity of declaration.dependencies) {
      const localDependency = byIdentity.get(dependencyIdentity)
      if (localDependency) {
        visit(localDependency, [...path, declaration.identity])
      }
    }
    visiting.delete(declaration.identity)
    if (!unsupportedReason) {
      visited.add(declaration.identity)
      ordered.push(declaration)
    }
  }

  visit(root, [])
  return {
    root,
    declarations: unsupportedReason ? [] : ordered,
    unsupportedReason,
  }
}

/** Removes only the declaration statement and at most one adjacent blank line. */
export function removeExtractedTypeDeclaration(
  source: string,
  declaration: ExtractableSFCTypeDeclaration,
): string {
  let start = declaration.range.start
  let end = declaration.range.end
  if (source[end] === '\r' && source[end + 1] === '\n') {
    end += 2
  }
  else if (source[end] === '\n') {
    end += 1
  }

  const beforeLineStart = source.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  if (!source.slice(beforeLineStart, start).trim()) {
    start = beforeLineStart
  }

  return `${source.slice(0, start)}${source.slice(end)}`
}

/** Removes a declaration set without invalidating the original absolute ranges. */
export function removeExtractedTypeDeclarations(
  source: string,
  declarations: readonly ExtractableSFCTypeDeclaration[],
): string {
  return [...declarations]
    .sort((left, right) => right.range.start - left.range.start)
    .reduce((result, declaration) => removeExtractedTypeDeclaration(result, declaration), source)
}
