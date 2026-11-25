import { timelineRecipeInstant } from '@endge/core'

type FieldKind = 'instant' | 'duration' | 'scalar'

const durationName = /duration|delay|offset|elapsed|latency|lead|lag|buffer|timeSpent|ms$|milliseconds?$/i
const instantName = /(?:time(?:ms)?|timestamp(?:ms)?|date|At(?:Ms)?|_at(?:_ms)?)$/i

function fieldKind(path: string, value: string | number | boolean): FieldKind {
  const leaf = path.split('.').at(-1) ?? path
  if (typeof value === 'string' && Number.isFinite(timelineRecipeInstant(value))) {
    return 'instant'
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'scalar'
  }
  if (path === 'startTime' || path === 'endTime' || (instantName.test(leaf) && Math.abs(value) >= 100_000_000_000)) {
    return 'instant'
  }
  if (durationName.test(leaf) && !/(?:seconds?|minutes?|hours?|secs?|mins?)$/i.test(leaf.replace(/milliseconds?$/i, 'ms'))) {
    return 'duration'
  }
  return 'scalar'
}

export function collectTimelineRecipeFields(tasks: readonly object[]): Record<FieldKind, string[]> {
  const fields = new Map<string, Set<FieldKind>>()
  for (const task of tasks) {
    const visit = (data: object, prefix: string, depth: number) => {
      for (const [key, value] of Object.entries(data)) {
        if (key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue
        }
        const path = prefix ? `${prefix}.${key}` : key
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          const types = fields.get(path) ?? new Set<FieldKind>()
          types.add(fieldKind(path, value))
          fields.set(path, types)
        }
        else if (value && typeof value === 'object' && !Array.isArray(value) && depth < 5) {
          visit(value, path, depth + 1)
        }
      }
    }
    visit(task, '', 0)
  }
  const result: Record<FieldKind, string[]> = { instant: ['startTime', 'endTime'], duration: [], scalar: [] }
  for (const [path, types] of fields) {
    const type = types.size === 1 ? [...types][0] : 'scalar'
    if (!result[type].includes(path)) {
      result[type].push(path)
    }
  }
  return result
}
