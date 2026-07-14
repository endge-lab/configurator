/* eslint-disable style/max-statements-per-line */
import type {
  ExtractableSFCColumn,
  ExtractComponentDependency,
} from './extract-component.types'
import type {
  RComponentSFC_AST,
  RComponentSFC_AST_ElementNode,
  RComponentSFC_AST_TemplateNode,
} from '@endge/core'

import { analyzeComponentSFCScript, parseComponentSFC } from '@endge/core'
import ts from 'typescript'

const BUILT_IN_TAGS = new Set([
  'Text',
  'DateTime',
  'Number',
  'Icon',
  'Badge',
  'Dot',
  'Box',
  'Flex',
  'Divider',
  'Input',
  'Textarea',
  'Checkbox',
  'Select',
  'Component',
  'Table',
  'Column',
  'Cell',
  'ColumnMenu',
  'MenuItem',
  'MenuSeparator',
])

const GLOBAL_BINDINGS = new Set([
  'Array',
  'BigInt',
  'Boolean',
  'Date',
  'Infinity',
  'JSON',
  'Map',
  'Math',
  'NaN',
  'Number',
  'Object',
  'Promise',
  'RegExp',
  'Set',
  'String',
  'Symbol',
  'URL',
  'console',
  'decodeURIComponent',
  'encodeURIComponent',
  'false',
  'null',
  'parseFloat',
  'parseInt',
  'true',
  'undefined',
  '$event',
  'Raph',
  'raph',
])

interface CollectedRead {
  path: string[]
  hasWrite: boolean
}

interface DependencyAccumulator {
  propName: string
  sourceExpression: string
  type: string
  paths: Set<string>
  hasWrite: boolean
}

export function analyzeExtractableSFCColumns(source: string): ExtractableSFCColumn[] {
  const parsed = parseComponentSFC(source)
  if (!parsed.ast?.template) { return [] }

  const propTypes = readParentPropTypes(parsed.ast)
  const result: ExtractableSFCColumn[] = []

  for (const root of parsed.ast.template.roots) { collectTableColumns(root, source, propTypes, result) }

  return result
}

export function resolveExtractableSFCColumn(source: string, columnStart: number): ExtractableSFCColumn | null {
  return analyzeExtractableSFCColumns(source)
    .find(column => column.columnRange.start === columnStart) ?? null
}

function collectTableColumns(
  node: RComponentSFC_AST_TemplateNode,
  source: string,
  propTypes: Map<string, string>,
  result: ExtractableSFCColumn[],
): void {
  if (node.kind !== 'element') { return }

  if (node.tag === 'Table') {
    for (const child of node.children) {
      if (child.kind !== 'element' || child.tag !== 'Column') { continue }

      const column = analyzeColumn(child, source, propTypes)
      if (column) { result.push(column) }
    }
  }

  for (const child of node.children) { collectTableColumns(child, source, propTypes, result) }
}

function analyzeColumn(
  column: RComponentSFC_AST_ElementNode,
  source: string,
  propTypes: Map<string, string>,
): ExtractableSFCColumn | null {
  const cell = column.children.find(
    (node): node is RComponentSFC_AST_ElementNode => node.kind === 'element' && node.tag === 'Cell',
  )
  const renderNodes = cell?.children ?? column.children
  const significantNodes = renderNodes.filter(isRenderableNode)

  if (!significantNodes.length || isSoleComponentReference(significantNodes)) { return null }

  const bodyRange = {
    start: significantNodes[0]!.range.start,
    end: significantNodes[significantNodes.length - 1]!.range.end,
  }
  const bodySource = source.slice(bodyRange.start, bodyRange.end)

  return {
    columnRange: { ...column.range },
    tagNameEnd: column.range.start + `<${column.tag}`.length,
    bodyRange,
    columnKey: readStaticAttribute(column, 'key'),
    columnTitle: readStaticAttribute(column, 'title'),
    bodySource,
    bodyFingerprint: fingerprint(bodySource),
    hasCell: Boolean(cell),
    dependencies: collectDependencies(significantNodes, propTypes),
  }
}

function isRenderableNode(node: RComponentSFC_AST_TemplateNode): boolean {
  return node.kind !== 'text' || Boolean(node.content.trim())
}

function isSoleComponentReference(nodes: RComponentSFC_AST_TemplateNode[]): boolean {
  if (nodes.length !== 1 || nodes[0]?.kind !== 'element') { return false }

  return nodes[0].tag === 'Component' || !BUILT_IN_TAGS.has(nodes[0].tag)
}

function readStaticAttribute(node: RComponentSFC_AST_ElementNode, name: string): string | null {
  const attribute = node.attributes.find(item => item.name === name && !item.dynamic)
  if (attribute?.value?.trim()) { return attribute.value.trim() }

  if (name === 'key') {
    const directive = node.directives.find(item => item.name === 'key')
    return directive?.expression?.trim() || null
  }

  return null
}

function readParentPropTypes(ast: RComponentSFC_AST): Map<string, string> {
  const result = new Map<string, string>()
  const script = analyzeComponentSFCScript(ast.script)
  for (const prop of script.props) { result.set(prop.name, prop.type || 'unknown') }
  return result
}

function collectDependencies(
  roots: RComponentSFC_AST_TemplateNode[],
  propTypes: Map<string, string>,
): ExtractComponentDependency[] {
  const dependencies = new Map<string, DependencyAccumulator>()

  for (const root of roots) { collectNodeDependencies(root, new Set(), dependencies, propTypes) }

  return [...dependencies.values()]
    .map(item => ({
      propName: item.propName,
      sourceExpression: item.sourceExpression,
      type: item.type,
      paths: [...item.paths].sort(),
      hasWrite: item.hasWrite,
    }))
    .sort((left, right) => left.propName.localeCompare(right.propName))
}

function collectNodeDependencies(
  node: RComponentSFC_AST_TemplateNode,
  inheritedLocals: Set<string>,
  dependencies: Map<string, DependencyAccumulator>,
  propTypes: Map<string, string>,
): void {
  if (node.kind === 'interpolation') {
    addExpressionDependencies(node.expression, inheritedLocals, dependencies, propTypes)
    return
  }

  if (node.kind !== 'element') { return }

  const childLocals = new Set(inheritedLocals)

  for (const attribute of node.attributes) {
    if (attribute.dynamic && attribute.value) { addExpressionDependencies(attribute.value, inheritedLocals, dependencies, propTypes) }
  }

  for (const directive of node.directives) {
    const expression = directive.expression?.trim()
    if (!expression) { continue }

    if (directive.name === 'for') {
      const parsed = parseForExpression(expression)
      addExpressionDependencies(parsed.source, inheritedLocals, dependencies, propTypes)
      for (const alias of parsed.aliases) { childLocals.add(alias) }
      continue
    }

    addExpressionDependencies(
      expression,
      directive.name === 'on' ? new Set([...inheritedLocals, '$event']) : inheritedLocals,
      dependencies,
      propTypes,
      directive.name === 'model',
    )
  }

  for (const child of node.children) { collectNodeDependencies(child, childLocals, dependencies, propTypes) }
}

function parseForExpression(expression: string): { aliases: string[], source: string } {
  const normalized = expression.trim()
  const separator = /\s(?:in|of)\s/.exec(normalized)
  if (!separator || separator.index <= 0) { return { aliases: [], source: expression } }

  const aliasSource = normalized
    .slice(0, separator.index)
    .trim()
    .replace(/^\(|\)$/g, '')
  const source = normalized.slice(separator.index + separator[0].length).trim()
  if (!source) { return { aliases: [], source: expression } }

  const aliases = aliasSource
    .split(',')
    .map(value => value.trim())
    .filter(value => /^[A-Z_$][\w$]*$/i.test(value))

  return { aliases, source }
}

function addExpressionDependencies(
  expression: string,
  inheritedLocals: Set<string>,
  dependencies: Map<string, DependencyAccumulator>,
  propTypes: Map<string, string>,
  forceWrite = false,
): void {
  for (const read of collectExpressionReads(expression, inheritedLocals)) {
    const root = read.path[0]
    if (!root || inheritedLocals.has(root) || GLOBAL_BINDINGS.has(root)) { continue }

    const isPropsObject = root === 'props' && Boolean(read.path[1])
    const propName = isPropsObject ? read.path[1]! : root
    const sourceExpression = isPropsObject ? `props.${propName}` : root
    const path = read.path.slice(isPropsObject ? 2 : 1).join('.')
    const existing = dependencies.get(propName) ?? {
      propName,
      sourceExpression,
      type: propTypes.get(propName) ?? 'unknown',
      paths: new Set<string>(),
      hasWrite: false,
    }

    existing.paths.add(path)
    existing.hasWrite ||= read.hasWrite || forceWrite
    dependencies.set(propName, existing)
  }
}

function collectExpressionReads(expression: string, inheritedLocals: Set<string>): CollectedRead[] {
  const sourceFile = ts.createSourceFile(
    'component-sfc-expression.ts',
    expression,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const declared = new Set(inheritedLocals)
  const reads = new Map<string, CollectedRead>()

  const collectDeclarations = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node)
      || ts.isParameter(node)
      || ts.isFunctionDeclaration(node)
      || ts.isFunctionExpression(node)
      || ts.isClassDeclaration(node)
    ) {
      collectBindingNames(node.name, declared)
    }
    ts.forEachChild(node, collectDeclarations)
  }
  collectDeclarations(sourceFile)

  const visit = (node: ts.Node): void => {
    if (isAccessExpression(node) && !isNestedAccessObject(node)) {
      const path = readAccessPath(node)
      if (path.length && !declared.has(path[0]!)) {
        const key = path.join('.')
        const existing = reads.get(key)
        reads.set(key, {
          path,
          hasWrite: Boolean(existing?.hasWrite || isWriteTarget(node)),
        })
      }
    }
    else if (ts.isIdentifier(node) && isIdentifierReference(node) && !declared.has(node.text)) {
      const existing = reads.get(node.text)
      reads.set(node.text, {
        path: [node.text],
        hasWrite: Boolean(existing?.hasWrite || isWriteTarget(node)),
      })
    }

    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return [...reads.values()]
}

function collectBindingNames(name: ts.BindingName | undefined, target: Set<string>): void {
  if (!name) { return }
  if (ts.isIdentifier(name)) {
    target.add(name.text)
    return
  }
  for (const element of name.elements) {
    if (!ts.isOmittedExpression(element)) { collectBindingNames(element.name, target) }
  }
}

function isAccessExpression(node: ts.Node): node is ts.PropertyAccessExpression | ts.ElementAccessExpression {
  return ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)
}

function isNestedAccessObject(node: ts.PropertyAccessExpression | ts.ElementAccessExpression): boolean {
  const parent = node.parent
  return isAccessExpression(parent) && parent.expression === node
}

function readAccessPath(node: ts.Expression): string[] {
  if (ts.isIdentifier(node)) { return [node.text] }

  if (ts.isPropertyAccessExpression(node)) {
    const objectPath = readAccessPath(node.expression)
    return objectPath.length ? [...objectPath, node.name.text] : []
  }

  if (ts.isElementAccessExpression(node)) {
    const objectPath = readAccessPath(node.expression)
    if (!objectPath.length) { return [] }
    const argument = node.argumentExpression
    if (argument && (ts.isStringLiteral(argument) || ts.isNumericLiteral(argument))) { return [...objectPath, argument.text] }
    return objectPath
  }

  return []
}

function isIdentifierReference(node: ts.Identifier): boolean {
  const parent = node.parent
  if (!parent) { return false }

  if (
    ts.isBinaryExpression(parent)
    && parent.left === node
    && ts.isElementAccessExpression(parent.parent)
    && parent.parent.argumentExpression === parent
  ) {
    // Endge SFC supports selectors such as attributes[name='ACTail'].
    // The selector key is part of the access syntax, not an external binding.
    return false
  }

  if (isAccessExpression(parent) && parent.expression === node) { return false }
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) { return false }
  if (
    (ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent))
    && parent.name === node
  ) {
    return false
  }
  if (
    (ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isFunctionDeclaration(parent)
      || ts.isFunctionExpression(parent) || ts.isClassDeclaration(parent))
    && parent.name === node
  ) {
    return false
  }
  if (ts.isTypeNode(parent) || ts.isImportSpecifier(parent) || ts.isImportClause(parent)) { return false }

  return true
}

function isWriteTarget(node: ts.Node): boolean {
  const parent = node.parent
  if (!parent) { return false }

  if (ts.isBinaryExpression(parent) && parent.left === node) {
    return parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
      && parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  }

  return (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent))
    && (parent.operator === ts.SyntaxKind.PlusPlusToken || parent.operator === ts.SyntaxKind.MinusMinusToken)
}

function fingerprint(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}
