import type { Ref } from 'vue'

import { Endge } from '@endge/core'
import { shallowRef } from 'vue'
import { toast } from 'vue-sonner'

/** Нормализует query response для source/document inspection. */
export function normalizeQueryResult(result: unknown): Record<string, unknown[]> {
  if (result !== null && typeof result === 'object' && !Array.isArray(result)) {
    const root = result as Record<string, unknown>
    const dataVal = root.data
    if (dataVal && typeof dataVal === 'object' && !Array.isArray(dataVal)) {
      const nested = dataVal as Record<string, unknown>
      const out: Record<string, unknown[]> = {}
      for (const key of Object.keys(nested)) {
        const value = nested[key]
        if (Array.isArray(value))
          out[key] = value
      }
      if (Object.keys(out).length)
        return out
    }

    const out: Record<string, unknown[]> = {}
    for (const key of Object.keys(root)) {
      const value = root[key]
      if (Array.isArray(value))
        out[key] = value
    }
    if (Object.keys(out).length)
      return out
  }

  return {}
}

/** Query result kept for inspection without creating a legacy table runtime. */
export interface HelpData {
  queryIdentity: string
  resultByKey: Record<string, unknown[]>
  arraySample: unknown | null
  activeTabKey: string
}

const _helpData = shallowRef<HelpData | null>(null)

export class EndgeIDEDemonstration {
  public init(): void {}

  public reset(): void {
    _helpData.value = null
  }

  public get helpData(): Ref<HelpData | null> {
    return _helpData
  }

  public setHelpData(payload: HelpData | null): void {
    _helpData.value = payload
  }

  /** Выполняет query только для просмотра raw result в configurator. */
  public async runQueryAndSetHelpData(queryId: string | number): Promise<HelpData | null> {
    const query = Endge.domain.getQuery(queryId)
    if (!query) {
      toast.error('Запрос не найден')
      return null
    }

    try {
      const result = await query.run({})
      const resultByKey = Array.isArray(result)
        ? { data: result }
        : normalizeQueryResult(result)
      const activeTabKey = Object.keys(resultByKey)[0] ?? ''
      const queryIdentity = String(query.identity ?? '').trim()
      if (!queryIdentity) {
        toast.error('У запроса не задан identity')
        return null
      }

      const payload: HelpData = {
        queryIdentity,
        resultByKey,
        arraySample: Array.isArray(result) ? (result[0] ?? null) : null,
        activeTabKey,
      }
      _helpData.value = payload
      return payload
    }
    catch (error: any) {
      toast.error('Ошибка выполнения запроса', { description: error?.message })
      return null
    }
  }
}
