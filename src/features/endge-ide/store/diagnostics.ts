import type { DiagnosticsRecord } from '@endge/core'
import { Endge } from '@endge/core'
import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'
import type { DiagnosticsTreeNode } from '@/features/endge-ide/domain/types/diagnostics-presentation.type'
import { buildDiagnosticsTree } from '@/features/endge-ide/model/diagnostics/diagnostics-tree'

/** Reactive read-model локальной diagnostics session для configurator UI. */
export const useDiagnosticsStore = defineStore('endge-diagnostics-store', () => {
  const revision = ref(0)
  const unsubscribe = Endge.diagnostics.subscribe(() => { revision.value += 1 })
  onScopeDispose(unsubscribe)

  /** Возвращает плоские core records без UI mutation. */
  const records = computed<readonly DiagnosticsRecord[]>(() => {
    void revision.value
    return Endge.diagnostics.query()
  })

  /** Строит presentation tree только внутри configurator package. */
  const nodes = computed<DiagnosticsTreeNode[]>(() => buildDiagnosticsTree(records.value))

  /** Очищает bounded history текущей core diagnostics session. */
  function clear(): void {
    Endge.diagnostics.clear()
  }

  return { records, nodes, clear }
})
