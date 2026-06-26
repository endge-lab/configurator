import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useSubscribableRef } from '@endge/utils'
import type { LogRecord } from '@endge/core'
import { Endge } from '@endge/core'
import type { LogNode } from '@endge/core'
import { buildLogTree } from '@endge/core'

export const useDebugStore = defineStore('endge-debug-store', () => {
  const { refObj: debug } = useSubscribableRef(Endge.debug)

  /** Плоские записи (LogRecord[]) */
  const records = computed<LogRecord[]>(() => debug.value.getRecords())

  /** Агрегированные узлы для визуализации (LogNode[]) */
  const nodes = computed<LogNode[]>(() => {
    const tree = buildLogTree(records.value)
    console.log('records', records)
    console.log('tree', tree)
    return tree
  })

  /** Очистить все логи */
  function clear(): void {
    debug.value.clear()
  }

  return {
    debug,
    records,
    nodes,
    clear,
  }
})
