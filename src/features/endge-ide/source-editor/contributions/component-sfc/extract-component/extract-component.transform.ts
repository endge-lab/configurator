/* eslint-disable style/max-statements-per-line */
import type {
  ExtractableSFCColumn,
  ExtractComponentDialogDependency,
  ExtractComponentDialogResult,
} from './extract-component.types'

export function buildExtractedComponentSource(
  column: ExtractableSFCColumn,
  dependencies: ExtractComponentDialogDependency[],
): string {
  const propsSource = dependencies.length
    ? `defineProps<{\n${dependencies.map(dependency => `  ${dependency.propName}: ${dependency.type || 'unknown'}`).join('\n')}\n}>()`
    : ''
  const body = indentSource(dedentSource(column.bodySource).trim(), '  ')

  return `<script setup lang="ts">\n${propsSource}\n</script>\n\n<template>\n${body}\n</template>\n`
}

export function replaceExtractedColumnBody(
  source: string,
  column: ExtractableSFCColumn,
  result: ExtractComponentDialogResult,
): string {
  const currentBody = source.slice(column.bodyRange.start, column.bodyRange.end)
  if (fingerprint(currentBody) !== column.bodyFingerprint) { throw new Error('Содержимое колонки изменилось. Повторите экспорт компонента.') }

  const invocation = buildComponentInvocation(result)
  const leadingWhitespace = currentBody.match(/^\s*/)?.[0] ?? ''
  const trailingWhitespace = currentBody.match(/\s*$/)?.[0] ?? ''
  const replacement = `${leadingWhitespace}${invocation}${trailingWhitespace}`

  return `${source.slice(0, column.bodyRange.start)}${replacement}${source.slice(column.bodyRange.end)}`
}

function buildComponentInvocation(result: ExtractComponentDialogResult): string {
  const attributes = result.dependencies
    .map(dependency => `:${dependency.propName}="${dependency.sourceExpression}"`)
  const head = result.tag
    ? result.tag
    : `Component is="${escapeAttribute(result.identity)}"`

  return `<${[head, ...attributes].join(' ')} />`
}

function dedentSource(source: string): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const nonEmpty = lines.filter(line => line.trim())
  const indent = nonEmpty.length
    ? Math.min(...nonEmpty.map(line => line.match(/^\s*/)?.[0].length ?? 0))
    : 0

  return lines.map(line => line.slice(Math.min(indent, line.length))).join('\n')
}

function indentSource(source: string, indent: string): string {
  if (!source) { return indent }
  return source.split('\n').map(line => `${indent}${line}`).join('\n')
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function fingerprint(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}
