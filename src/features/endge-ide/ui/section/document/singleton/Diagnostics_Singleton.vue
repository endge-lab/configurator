<script setup lang="ts">
/**
 * Вкладка «Диагностика» показывает bounded session, которую хранит EndgeDiagnostics.
 * Компонент не меняет core records и отвечает только за presentation layer.
 */
import { Activity, Eraser } from 'lucide-vue-next'
import { computed } from 'vue'
import { Endge } from '@endge/core'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import LogTree from '@/features/endge-ide/ui/components/LogTree.vue'
import { buildDiagnosticsTree } from '@/features/endge-ide/model/diagnostics/diagnostics-tree'
import { useSubscribableModuleRef } from '@/features/endge-ide/model/diagnostics/use-subscribable-module-ref'

const telemetryRef = useSubscribableModuleRef(Endge.diagnostics.telemetry)
const problemsRef = useSubscribableModuleRef(Endge.diagnostics.problems)
const records = computed(() => {
  void telemetryRef.value
  return Endge.diagnostics.telemetry.query()
})
const nodes = computed(() => buildDiagnosticsTree(records.value))
const problemCount = computed(() => {
  void problemsRef.value
  return Endge.diagnostics.problems.query().length
})

/** Считает количество records каждого core signal для краткой сводки. */
const signalCounters = computed(() => {
  let logs = 0
  let spans = 0
  for (const record of records.value) {
    if (record.signal === 'log')
      logs += 1
    else
      spans += 1
  }
  return { logs, spans }
})

/** Очищает локальную diagnostics history текущей Endge session. */
function clearDiagnostics(): void {
  Endge.diagnostics.telemetry.clear()
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3 p-3">
    <Card class="shrink-0 p-3">
      <div class="flex flex-wrap items-center gap-3">
        <Activity class="size-4 text-muted-foreground" />
        <span class="text-sm font-medium">Текущая diagnostics session</span>
        <Badge variant="secondary" class="font-mono text-xs">
          записей: {{ records.length }}
        </Badge>
        <Badge variant="outline" class="font-mono text-xs">
          logs: {{ signalCounters.logs }}
        </Badge>
        <Badge variant="outline" class="font-mono text-xs">
          spans: {{ signalCounters.spans }}
        </Badge>
        <Badge variant="outline" class="font-mono text-xs">
          problems: {{ problemCount }}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          class="ml-auto gap-1.5"
          :disabled="records.length === 0"
          @click="clearDiagnostics"
        >
          <Eraser class="size-3.5" />
          Очистить
        </Button>
      </div>
    </Card>

    <Card class="min-h-0 flex-1 overflow-hidden p-0">
      <div class="border-b px-3 py-2">
        <div class="text-sm font-medium">Логи и завершённые spans</div>
        <div class="text-xs text-muted-foreground">
          Дерево строится в configurator-е из независимых core records.
        </div>
      </div>
      <ScrollArea class="h-[calc(100%-3.25rem)]">
        <div v-if="nodes.length === 0" class="p-4 text-sm text-muted-foreground">
          Диагностических записей пока нет.
        </div>
        <div v-else class="p-2">
          <LogTree :nodes="nodes" />
        </div>
      </ScrollArea>
    </Card>
  </div>
</template>
