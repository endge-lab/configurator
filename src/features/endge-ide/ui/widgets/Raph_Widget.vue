<script setup lang="ts">
import type { RaphPhase } from '@endge/raph'
import { Raph } from '@endge/raph'
import { onBeforeUnmount, onMounted, ref, triggerRef } from 'vue'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import RaphTreeItem from '@/features/endge-ide/ui/widgets/components/RaphTreeItem.vue'
import { useSafeLocalStorage } from '@/lib/use-safe-local-storage'

/** Дерево узлов (Raph.debug.getTree()) */
interface NodeTree {
  id: string
  type?: string
  children: NodeTree[]
  routes: string[]
}

/** Группа событий при записи */
interface EventGroup {
  phase: string
  path: string
  nodes: Array<{ id?: string }>
  resolvedSamples: Array<Array<{ segment: string; keyField: string; keyValue: unknown; index?: number }>>
}

const activeTab = useSafeLocalStorage('endge-raph-widget-tab', 'phases')
const recordingEnabled = ref(false)
const unsubscribe: (() => void)[] = []

const phases = ref<RaphPhase[]>([])
const tree = ref<NodeTree[]>([])
const events = ref<EventGroup[]>([])
const metrics = ref({ ups: 0, nps: 0, eps: 0 })

const MAX_HISTORY = 200
const MAX_SAMPLES_PER_GROUP = 3

function refreshPhases(): void {
  try {
    phases.value = (Raph.app as any).phases ?? []
  } catch {
    phases.value = []
  }
  triggerRef(phases)
}

function refreshNodes(): void {
  try {
    tree.value = Raph.debug.getTree() as NodeTree[]
  } catch {
    tree.value = []
  }
}

function toggleRecording(): void {
  recordingEnabled.value = !recordingEnabled.value
  if (recordingEnabled.value) events.value = []
}

onMounted(() => {
  unsubscribe.push(Raph.events.on('phases:reinit', refreshPhases))
  unsubscribe.push(Raph.events.on('debug:nodes', refreshNodes))
  unsubscribe.push(
    Raph.events.on('nodes:notified', (p: { ctxs: Array<{ phase: string; node: any; events?: any[] }> }) => {
      if (!recordingEnabled.value) return
      const group = new Map<string, EventGroup & { _dedup?: Set<string> }>()
      for (const ctx of p.ctxs) {
        const phase = ctx.phase
        const node = ctx.node
        const evs = ctx.events ?? []
        for (const ev of evs) {
          const canonical = ev?.canonical ?? ''
          const key = `${phase}|${canonical}`
          let g = group.get(key)
          if (!g) {
            g = {
              phase,
              path: canonical,
              nodes: [],
              resolvedSamples: [],
              _dedup: new Set<string>(),
            }
            group.set(key, g)
          }
          g.nodes.push(node)
          if (Array.isArray(ev?.resolved) && ev.resolved.length && g.resolvedSamples.length < MAX_SAMPLES_PER_GROUP) {
            const sig = JSON.stringify(ev.resolved)
            if (!g._dedup!.has(sig)) {
              g._dedup!.add(sig)
              g.resolvedSamples.push(ev.resolved)
            }
          }
        }
      }
      if (group.size) {
        const payload = Array.from(group.values()).map(({ _dedup, ...rest }) => rest)
        events.value.push(...payload)
        if (events.value.length > MAX_HISTORY) {
          events.value.splice(0, events.value.length - MAX_HISTORY)
        }
      }
    }),
  )
  unsubscribe.push(
    Raph.events.on('debug:metrics', (m: { ups?: number; nps?: number; eps?: number }) => {
      metrics.value = {
        ups: m?.ups ?? 0,
        nps: m?.nps ?? 0,
        eps: m?.eps ?? 0,
      }
    }),
  )
  refreshPhases()
  refreshNodes()
})

onBeforeUnmount(() => {
  unsubscribe.forEach((fn) => fn?.())
  unsubscribe.length = 0
})
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="shrink-0 px-3 py-2 border-b flex items-center justify-between gap-2">
      <div class="text-xs text-muted-foreground flex items-center gap-3">
        <span>UPS: {{ metrics.ups.toFixed(1) }}/с</span>
        <span>EPS: {{ metrics.eps.toFixed(1) }}/с</span>
        <span>NPS: {{ metrics.nps.toFixed(1) }}/с</span>
      </div>
      <div class="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button size="icon" variant="ghost" class="size-8" @click="refreshPhases(); refreshNodes()">
                <i class="ti ti-refresh text-base" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Обновить</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="size-8"
                :class="{ 'text-red-500': recordingEnabled }"
                @click="toggleRecording"
              >
                <i :class="recordingEnabled ? 'ti ti-player-record-filled' : 'ti ti-player-record'" class="text-base" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ recordingEnabled ? 'Выключить' : 'Включить' }} запись событий</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>

    <Tabs v-model="activeTab" class="flex-1 flex flex-col min-h-0">
      <TabsList class="shrink-0 w-full grid grid-cols-3 rounded-none border-b">
        <TabsTrigger value="phases" class="rounded-none">Фазы</TabsTrigger>
        <TabsTrigger value="nodes" class="rounded-none">Узлы</TabsTrigger>
        <TabsTrigger value="events" class="rounded-none">События</TabsTrigger>
      </TabsList>

      <TabsContent value="phases" class="flex-1 mt-0 min-h-0 overflow-hidden">
        <ScrollArea class="h-full">
          <div class="p-3 space-y-2">
            <details
              v-for="(phase, index) in phases"
              :key="index"
              class="border border-border rounded-md bg-muted/30"
            >
              <summary
                class="cursor-pointer flex items-center justify-between px-2 py-1.5 font-semibold text-xs hover:bg-muted transition-colors rounded-t-md"
              >
                <span class="truncate">
                  {{ (phase as any).name }} - {{ (phase as any).traversal }}
                  <span class="text-muted"> ({{ (phase as any).routes?.length ?? 0 }} routes)</span>
                </span>
              </summary>
              <ul class="pl-4 py-1 text-xs text-destructive list-disc">
                <li v-for="(route, idx) in (phase as any).routes" :key="idx" class="break-all">
                  {{ route }}
                </li>
              </ul>
            </details>
            <p v-if="!phases.length" class="text-xs text-muted-foreground">Пусто</p>
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="nodes" class="flex-1 mt-0 min-h-0 overflow-hidden">
        <ScrollArea class="h-full">
          <div class="p-3 space-y-1">
            <RaphTreeItem v-for="root in tree" :key="root.id" :node="root" :depth="0" />
            <p v-if="!tree.length" class="text-xs text-muted-foreground">Пусто</p>
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="events" class="flex-1 mt-0 min-h-0 overflow-hidden">
        <ScrollArea class="h-full">
          <div class="p-3 space-y-2">
            <div class="flex items-center gap-2 mb-2">
              <i
                v-if="recordingEnabled"
                class="ti ti-player-record-filled text-red-500 shrink-0"
                title="Запись идёт"
              />
              <span class="text-xs" :class="recordingEnabled ? 'text-red-500' : 'text-muted-foreground'">
                {{ recordingEnabled ? 'Запись идёт…' : 'Запись остановлена' }}
              </span>
              <span class="text-xs text-muted-foreground">({{ events.length }})</span>
            </div>
            <details
              v-for="(g, i) in events"
              :key="i"
              class="border border-border rounded-md bg-muted/30"
            >
              <summary
                class="cursor-pointer flex items-center justify-between px-2 py-1.5 font-semibold text-xs hover:bg-muted transition-colors rounded-t-md"
              >
                <span class="truncate">
                  <span class="text-primary">{{ g.phase }}</span>
                  <span class="text-muted"> - </span>
                  <span class="font-mono">{{ g.path }}</span>
                  <span class="text-muted"> - nodes: {{ g.nodes.length }}</span>
                  <span v-if="g.resolvedSamples?.length" class="text-muted"> • params: {{ g.resolvedSamples.length }}</span>
                </span>
              </summary>
              <div class="px-3 py-2 text-xs space-y-3">
                <div>
                  <div class="text-muted mb-1">Сработавшие узлы (id):</div>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="n in g.nodes"
                      :key="n?.id"
                      class="font-mono px-1.5 py-0.5 rounded bg-muted"
                    >
                      {{ n?.id ?? '(node)' }}
                    </span>
                  </div>
                </div>
                <div v-if="g.resolvedSamples?.length">
                  <div class="text-muted mb-1">Параметры (resolved)</div>
                  <div
                    v-for="(sample, si) in g.resolvedSamples"
                    :key="si"
                    class="overflow-auto"
                  >
                    <div v-if="g.resolvedSamples.length > 1" class="text-muted mb-1">вариант #{{ si + 1 }}</div>
                    <table class="w-full text-left border-collapse min-w-[320px] text-xs">
                      <thead class="text-muted">
                        <tr>
                          <th class="py-1 pr-2 border-b border-border">segment</th>
                          <th class="py-1 px-2 border-b border-border">keyField</th>
                          <th class="py-1 px-2 border-b border-border">keyValue</th>
                          <th class="py-1 pl-2 border-b border-border">index</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(r, ri) in sample" :key="ri" class="align-top">
                          <td class="py-1 pr-2 border-b border-border font-mono">{{ r.segment }}</td>
                          <td class="py-1 px-2 border-b border-border font-mono">{{ r.keyField }}</td>
                          <td class="py-1 px-2 border-b border-border">
                            <pre class="font-mono whitespace-pre-wrap break-all m-0">{{ r.keyValue }}</pre>
                          </td>
                          <td class="py-1 pl-2 border-b border-border font-mono">{{ r.index ?? '-' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </details>
            <p v-if="!events.length" class="text-xs text-muted-foreground">Пусто</p>
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  </div>
</template>
