<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { Endge } from '@endge/core'
import { Raph } from '@endge/raph'
import { SFC_RuntimeRenderer } from '@endge/vue'
import type {
  ComponentSFCRuntimeHost,
  EndgeBootContext,
  RuntimeBoundaryPatch,
  RuntimeHostUpdateContext,
} from '@endge/core'
import type { SFCVueRuntimeInputSource } from '@endge/vue'

const SFC_IDENTITY = 'test-sfc-table'
const RAPH_FLIGHTS_PATH = 'test.sfc.flights'
const MANUAL_BOOT_CONTEXT = {} as EndgeBootContext

const runtime = shallowRef<ComponentSFCRuntimeHost | null>(null)
const isExecuting = ref(false)
const errorMessage = ref<string | null>(null)
const raphSnapshot = shallowRef<Record<string, unknown>>({})
let runtimeDebugUnsubscribers: VoidFunction[] = []

const TEST_FLIGHTS: Record<string, unknown>[] = [
  {
    id: 'SU1402',
    number: 'SU 1402',
    status: 'Boarding',
    statusTone: 'success',
    std: '2026-07-05T13:45:00Z',
    route: 'SVO -> LED',
    counter: 0,
  },
  {
    id: 'DP209',
    number: 'DP 209',
    status: 'Delayed',
    statusTone: 'warning',
    std: '2026-07-05T11:10:00Z',
    route: 'VKO -> AER',
    counter: 0,
  },
  {
    id: 'SU99',
    number: 'SU 99',
    status: 'Check-in',
    statusTone: 'info',
    std: '2026-07-05T09:25:00Z',
    route: 'SVO -> KZN',
    counter: 0,
  },
  {
    id: 'FV3001',
    number: 'FV 3001',
    status: 'Closed',
    statusTone: 'neutral',
    std: '2026-07-05T16:40:00Z',
    route: 'LED -> SVO',
    counter: 0,
  },
]

const renderInput = computed<SFCVueRuntimeInputSource>(() => ({
  kind: 'raph',
  bindings: {
    flights: {
      path: RAPH_FLIGHTS_PATH,
      wildcardDynamic: true,
    },
  },
}))

function mockQuery() {
  const legs = [
    {
      id: 'leg1',
      flightCarrier: "SU",
      flightNumber: "522",
    }
  ]
  const attrs = [
    {
      legId: 'leg1',
      items: [
        {
          attrId: 'attr1',
          value: '2025-12-23T00:00:00Z',
        }
      ]
    }
  ]
  Raph.set('mockQuery.legs', legs)
  Raph.set('mockQuery.attrs', attrs)
}

async function executeSFC(): Promise<void> {
  isExecuting.value = true
  errorMessage.value = null

  try {
    destroyRuntime()
    prepareManualSFCExecution()
    logCompilerState('После ручной сборки domain -> program')

    const component = Endge.domain.getComponentSFC(SFC_IDENTITY)
    if (!component) {
      runtime.value = null
      resetRuntimeRenderState()
      errorMessage.value = `SFC component "${SFC_IDENTITY}" not found.`
      return
    }

    logDomainComponent(component)

    const host = Endge.runtime.execute(component, {
      target: 'dom',
      input: renderInput.value,
    }) as ComponentSFCRuntimeHost | null

    if (!host) {
      errorMessage.value = `SFC component "${SFC_IDENTITY}" was not executed.`
      return
    }

    setupRuntimeDebugLogs(host)
    seedRaphInput()
    runtime.value = host
    logRuntimeSystemInfo(host, 'После execute и seed Raph input')
  }
  catch (error) {
    resetRuntimeRenderState()
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    isExecuting.value = false
  }
}

function destroyRuntime(): void {
  cleanupRuntimeDebugLogs()
  if (runtime.value)
    Endge.runtime.destroyRuntime(runtime.value.id)
  runtime.value = null
  resetRuntimeRenderState()
}

function incrementCounter(): void {
  const flights = normalizeFlights(Raph.get(RAPH_FLIGHTS_PATH))
  const firstFlight = flights[0] ?? {}
  const nextCounter = Number(firstFlight.counter ?? 0) + 1

  console.groupCollapsed('[SFC Test] Изменение Raph данных: increment counter')
  console.log('Комментарий: это имитирует runtime-изменение данных, от которого должна проснуться ближайшая SFC boundary-нода.')
  console.log('Путь изменения:', `${RAPH_FLIGHTS_PATH}[0].counter`)
  console.log('Предыдущее значение:', firstFlight.counter ?? 0)
  console.log('Следующее значение:', nextCounter)
  console.groupEnd()

  Raph.set(`${RAPH_FLIGHTS_PATH}[0].counter`, nextCounter)
  refreshRaphSnapshot()
  logRaphSnapshot('После Raph.set counter')
}

function prepareManualSFCExecution(): void {
  Endge.compiler.build(MANUAL_BOOT_CONTEXT)
  Endge.runtime.start()
}

function resetRuntimeRenderState(): void {
  raphSnapshot.value = {}
}

function seedRaphInput(): void {
  Raph.set(RAPH_FLIGHTS_PATH, normalizeFlights(TEST_FLIGHTS))
  refreshRaphSnapshot()
  logRaphSnapshot('После seed test rows в Raph')
}

function refreshRaphSnapshot(): void {
  raphSnapshot.value = {
    flights: cloneValue(Raph.get(RAPH_FLIGHTS_PATH)),
  }
}

function normalizeFlights(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw))
    return []

  return raw
    .filter(item => item && typeof item === 'object' && !Array.isArray(item))
    .map(item => ({
      ...(item as Record<string, unknown>),
      counter: Number((item as Record<string, unknown>).counter ?? 0),
    }))
}

function cloneValue(value: unknown): unknown {
  if (value == null)
    return value

  try {
    return JSON.parse(JSON.stringify(value))
  }
  catch {
    return value
  }
}

function setupRuntimeDebugLogs(host: ComponentSFCRuntimeHost): void {
  cleanupRuntimeDebugLogs()

  const onPropsDirty = (ctx: RuntimeHostUpdateContext): void => {
    console.groupCollapsed('[SFC Test] RuntimeHost получил props:dirty')
    console.log('Комментарий: проснулась root/table boundary без точечного patch-а, bridge перечитает props из Raph.')
    console.log('Runtime:', {
      id: host.id,
      runtimeType: host.runtimeType,
      entityIdentity: host.entityIdentity,
    })
    console.log('Dirty root node:', summarizeRaphNode(ctx.node))
    console.log('События Raph:', ctx.events.map(event => ({
      canonical: event.canonical,
      op: event.op,
      value: cloneValue(event.value),
    })))
    console.log('Boundary records:', ctx.boundaries.map(boundary => ({
      boundary: summarizeRaphNode(boundary.boundary),
      dirtyNodes: boundary.dirtyNodes.map(summarizeRaphNode),
      events: boundary.events.map(event => event.canonical),
    })))
    console.groupEnd()
  }

  const onBoundaryDirty = (patch: RuntimeBoundaryPatch): void => {
    console.groupCollapsed('[SFC Test] RuntimeHost получил boundary:dirty patch')
    console.log('Комментарий: это точечный patch render-boundary. Для Table Vue adapter должен применить RevoGrid setDataAt без полного props rerender.')
    console.log('Runtime:', {
      id: host.id,
      runtimeType: host.runtimeType,
      entityIdentity: host.entityIdentity,
    })
    console.log('Patch:', {
      ...patch,
      itemSnapshot: cloneValue(patch.itemSnapshot),
      node: summarizeRaphNode(patch.node),
      events: patch.events.map(event => ({
        canonical: event.canonical,
        op: event.op,
        value: cloneValue(event.value),
      })),
    })
    console.groupEnd()
  }

  const onUpdate = (ctx: RuntimeHostUpdateContext): void => {
    console.groupCollapsed('[SFC Test] RuntimeHost update event')
    console.log('Комментарий: базовое runtime update событие после частной обработки ComponentSFCRuntimeHost.update().')
    console.log('Update node:', summarizeRaphNode(ctx.node))
    console.log('Events:', ctx.events.map(event => event.canonical))
    console.groupEnd()
  }

  host.on('props:dirty', onPropsDirty)
  host.on('boundary:dirty', onBoundaryDirty)
  host.on('update', onUpdate)
  runtimeDebugUnsubscribers = [
    () => host.off('props:dirty', onPropsDirty),
    () => host.off('boundary:dirty', onBoundaryDirty),
    () => host.off('update', onUpdate),
  ]
}

function cleanupRuntimeDebugLogs(): void {
  for (const unsubscribe of runtimeDebugUnsubscribers)
    unsubscribe()
  runtimeDebugUnsubscribers = []
}

function logCompilerState(stage: string): void {
  const snapshot = Endge.program.snapshot()

  console.groupCollapsed(`[SFC Test] ${stage}`)
  console.log('Комментарий: compiler.build() должен переложить domain entities в compiled program artifacts.')
  console.log('Program snapshot:', snapshot)
  console.groupEnd()
}

function logDomainComponent(component: unknown): void {
  console.groupCollapsed('[SFC Test] Domain SFC component')
  console.log('Комментарий: это исходная domain-сущность до runtime execute.')
  console.log('Identity:', SFC_IDENTITY)
  console.log('Component:', component)
  console.groupEnd()
}

function logRuntimeSystemInfo(host: ComponentSFCRuntimeHost, stage: string): void {
  const artifact = host.getArtifact()
  const ir = host.getIr()
  const runtimeDependencies = host.getRuntimeDependencies()

  console.groupCollapsed(`[SFC Test] ${stage}`)
  console.log('Комментарий: это главный снимок того, что runtime host знает о compiled SFC и входных данных.')
  console.log('Runtime host snapshot:', host.snapshot())
  console.log('Artifact summary:', artifact
    ? {
        ref: artifact.ref,
        status: artifact.status,
        sourceHash: artifact.sourceHash,
        compilerVersion: artifact.compilerVersion,
        capabilities: artifact.capabilities,
        diagnostics: artifact.diagnostics,
      }
    : null)
  console.log('Contract:', host.getContract())
  console.log('Component dependencies:', host.getDependencies())
  console.log('Runtime dependencies:', runtimeDependencies)
  console.log('Комментарий: эти paths получаются из runtimeDependencies + render input bindings и используются для Raph observeData.')
  console.table(resolveObservedRaphPaths(host))
  console.log('IR summary:', summarizeIr(ir))
  console.log('Preview props:', cloneValue(host.getPreviewProps()))
  console.log('Input source:', host.getInputSource())
  console.log('Raph snapshot:', cloneValue(raphSnapshot.value))
  console.groupEnd()
}

function logRaphSnapshot(stage: string): void {
  console.groupCollapsed(`[SFC Test] ${stage}`)
  console.log('Комментарий: текущее значение данных, из которых SFCVueRuntimeBridge материализует props.')
  console.log('Raph path:', RAPH_FLIGHTS_PATH)
  console.log('Snapshot:', cloneValue(raphSnapshot.value))
  console.groupEnd()
}

function resolveObservedRaphPaths(host: ComponentSFCRuntimeHost): Array<Record<string, unknown>> {
  const input = host.getInputSource()
  if (input?.kind !== 'raph')
    return []

  const dependencies = host.getRuntimeDependencies()
  const patchableSources = dependencies.boundaries.map(boundary => ({
    prop: boundary.sourceProp,
    path: boundary.sourcePath.join('.'),
  }))
  const rootRows = dependencies.props.flatMap((dependency) => {
    const coveredByBoundary = patchableSources.some(source => {
      return source.prop === dependency.prop
        && (source.path === '' || dependency.path.join('.').startsWith(source.path))
    })
    if (coveredByBoundary)
      return []

    const binding = input.bindings[dependency.prop]
    if (!binding?.path)
      return []

    const path = joinRaphPath(binding.path, dependency.path)
    if (!path)
      return []

    const observedPaths = dependency.path.length > 0
      ? [path]
      : [path, `${path}.*`]

    return observedPaths.map(observedPath => ({
      node: 'root',
      prop: dependency.prop,
      dependencyPath: dependency.path.join('.') || '(весь prop)',
      rawRead: dependency.raw,
      bindingPath: binding.path,
      observedPath,
      wildcardDynamic: binding.wildcardDynamic ?? true,
    }))
  })

  const boundaryRows = dependencies.boundaries.flatMap((boundary) => {
    const binding = input.bindings[boundary.sourceProp]
    if (!binding?.path)
      return []

    const sourcePath = joinRaphPath(binding.path, boundary.sourcePath)
    const tableRow = {
      node: `table:${boundary.id}`,
      prop: boundary.sourceProp,
      dependencyPath: boundary.sourcePath.join('.') || '(вся коллекция)',
      rawRead: '<Table rows>',
      bindingPath: binding.path,
      observedPath: sourcePath,
      wildcardDynamic: binding.wildcardDynamic ?? true,
    }

    const columnRows = boundary.columns.flatMap((column) => {
      const reads = column.rowReads.length > 0 ? column.rowReads : [column.key]
      return reads.map(read => ({
        node: `column:${column.key}`,
        prop: boundary.sourceProp,
        dependencyPath: `${boundary.sourcePath.join('.') || '(коллекция)'}[*].${read}`,
        rawRead: `row.${read}`,
        bindingPath: binding.path,
        observedPath: `${sourcePath}[*].${read}`,
        wildcardDynamic: binding.wildcardDynamic ?? true,
      }))
    })

    return [tableRow, ...columnRows]
  })

  return [...rootRows, ...boundaryRows]
}

function joinRaphPath(basePath: string, childPath: string[]): string {
  const base = String(basePath ?? '').trim().replace(/\.$/, '')
  const child = childPath
    .map(part => String(part ?? '').trim())
    .filter(Boolean)
    .join('.')

  if (!base)
    return child
  if (!child)
    return base

  return `${base}.${child}`
}

function summarizeIr(ir: ReturnType<ComponentSFCRuntimeHost['getIr']>): Record<string, unknown> | null {
  if (!ir)
    return null

  const tags = new Map<string, number>()
  for (const root of ir.template.roots)
    collectIrTags(root, tags)

  return {
    version: ir.version,
    props: ir.script.props,
    locals: ir.script.locals,
    rootCount: ir.template.roots.length,
    tags: Object.fromEntries(tags.entries()),
    hasStyle: Boolean(ir.style),
  }
}

function collectIrTags(node: any, tags: Map<string, number>): void {
  if (node?.kind !== 'element')
    return

  tags.set(node.tag, (tags.get(node.tag) ?? 0) + 1)
  for (const child of node.children ?? [])
    collectIrTags(child, tags)
}

function summarizeRaphNode(node: any): Record<string, unknown> {
  return {
    id: node?.id,
    meta: cloneValue(node?.meta),
  }
}

onBeforeUnmount(() => {
  destroyRuntime()
})

onMounted(() => {
  void executeSFC()
})
</script>

<template>
  <main class="p-6 flex flex-col gap-4">
    <div class="flex items-center gap-3">
      <button
        class="px-3 py-2 border rounded bg-background hover:bg-muted"
        type="button"
        :disabled="isExecuting"
        @click="executeSFC"
      >
        {{ isExecuting ? 'Executing...' : 'Execute test-sfc-table' }}
      </button>

      <button
        class="px-3 py-2 border rounded bg-background hover:bg-muted disabled:opacity-50"
        type="button"
        :disabled="!runtime"
        @click="destroyRuntime"
      >
        Destroy runtime
      </button>

      <button
        class="px-3 py-2 border rounded bg-background hover:bg-muted disabled:opacity-50"
        type="button"
        :disabled="!runtime"
        @click="incrementCounter"
      >
        Increment counter
      </button>
    </div>

    <p v-if="errorMessage" class="text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <section v-if="runtime" class="flex flex-col gap-3 min-h-0">
      <div class="text-sm text-muted-foreground">
        {{ runtime.runtimeType }} / {{ runtime.entityIdentity }}
      </div>

      <div class="border rounded p-4">
        <SFC_RuntimeRenderer
          :host="runtime"
          :input="renderInput"
        />
      </div>

      <pre class="text-xs overflow-auto border rounded p-3">{{ raphSnapshot }}</pre>
    </section>
  </main>
</template>
