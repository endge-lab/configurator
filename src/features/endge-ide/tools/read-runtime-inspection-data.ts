import { DataPath, SegKind } from '@endge/raph'

/** Читает канонический путь в snapshot через чистый parser, без обращения к Raph.app. */
export function readRuntimeInspectionData(data: unknown, path: string): unknown {
  let value = data
  for (const segment of DataPath.fromString(path).segments()) {
    if (value === null || typeof value !== 'object') {
      return undefined
    }
    if (segment.kind === SegKind.Key || segment.kind === SegKind.Index) {
      const key = segment.kind === SegKind.Key ? segment.key! : String(segment.index)
      if (!Object.hasOwn(value, key)) {
        return undefined
      }
      value = (value as Record<string, unknown>)[key]
    }
    else if (segment.kind === SegKind.Param && Array.isArray(value)) {
      value = value.find(item => item !== null && typeof item === 'object' && Object.hasOwn(item, segment.pkey!) && item[segment.pkey!] === segment.pval)
    }
    else {
      return undefined
    }
  }
  return value
}
