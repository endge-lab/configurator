<script setup lang="ts">
import type {
  ComponentSFCRuntimeHost,
  CompositionSession,
  QueryRuntimeHost,
  RuntimeHostInputSource,
} from '@endge/core'

import { Endge } from '@endge/core'
import { Raph, RaphDerivedNode } from '@endge/raph'
import { SFC_RuntimeRenderer } from '@endge/vue'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

const QUERY_IDENTITY = 'schedule'
const COMPONENT_IDENTITY = 'shedule-sfc'
const COMPOSITION_IDENTITY = 'test-composition'
const COMPOSITION_RUNTIME_ID = 'test-page:test-composition'
const RAW_PATH = 'queries.schedule.raw'
const TABLE_PATH = 'queries.schedule.table'
const UI_TEXT = {
  mounting: 'Запуск...',
  mount: 'Запустить test-composition',
  querying: 'Запрос...',
  query: 'Повторить query schedule',
  applyingSSE: 'SSE update...',
  emulateSSE: 'SSE: изменить номер первого рейса',
  stop: 'Остановить runtime',
  rawRow: 'Первая raw-строка',
  tableRow: 'Первая table-строка',
  derivedNode: 'Raph Derived node',
} as const

const session = shallowRef<CompositionSession | null>(null)
const isMounting = ref(false)
const isRunningQuery = ref(false)
const isApplyingSSE = ref(false)
const errorMessage = ref<string | null>(null)
const lastAction = ref('Композиция ещё не запущена.')
const rawSnapshot = shallowRef<unknown>(undefined)
const tableSnapshot = shallowRef<unknown>(undefined)
const derivedSnapshot = shallowRef<Record<string, unknown> | null>(null)
let sseRevision = 0
let storeUnsubscribers: VoidFunction[] = []

const compositionRuntime = computed(() => session.value?.host ?? null)
const componentRuntime = computed<ComponentSFCRuntimeHost | null>(() => {
  const runtime = compositionRuntime.value?.getChild('table')
  return runtime?.entityType === 'component-sfc'
    ? runtime as ComponentSFCRuntimeHost
    : null
})
const queryRuntime = computed<QueryRuntimeHost | null>(() => {
  const runtime = compositionRuntime.value?.getChild('query')
  return runtime?.entityType === 'query'
    ? runtime as QueryRuntimeHost
    : null
})
const renderInput = computed<RuntimeHostInputSource>(() => {
  return componentRuntime.value?.getInputSource() ?? { kind: 'local', props: {} }
})
const hasRawRows = computed(() => Array.isArray(rawSnapshot.value) && rawSnapshot.value.length > 0)
const firstRawRow = computed(() => firstRow(rawSnapshot.value))
const firstTableRow = computed(() => firstRow(tableSnapshot.value))

async function mountComposition(): Promise<void> {
  isMounting.value = true
  errorMessage.value = null

  try {
    destroyComposition()
    await Endge.build()
    assertDomainEntities()
    compileTestArtifacts()

    session.value = await Endge.composition.mount(COMPOSITION_IDENTITY, {
      id: COMPOSITION_RUNTIME_ID,
    })

    if (!componentRuntime.value) {
      throw new Error(`Composition runtime "table" не создал component "${COMPONENT_IDENTITY}".`)
    }
    if (!queryRuntime.value) {
      throw new Error(`Composition runtime "query" не создал query "${QUERY_IDENTITY}".`)
    }

    attachStoreWatchers()
    refreshSnapshots()
    lastAction.value = 'Composition смонтирована; onMount выполнил query и materialized DataView.'
  }
  catch (error) {
    destroyComposition()
    errorMessage.value = toErrorMessage(error)
  }
  finally {
    isMounting.value = false
  }
}

async function runQuery(): Promise<void> {
  const runtime = queryRuntime.value
  if (!runtime) {
    return
  }

  isRunningQuery.value = true
  errorMessage.value = null
  try {
    await runtime.run()
    refreshSnapshots()
    lastAction.value = 'Query выполнен повторно: raw заменён целиком, DataView сделал full recompute.'
  }
  catch (error) {
    errorMessage.value = toErrorMessage(error)
  }
  finally {
    isRunningQuery.value = false
  }
}

function emulateSSEUpdate(): void {
  const rows = rawSnapshot.value
  if (!Array.isArray(rows) || rows.length === 0) {
    errorMessage.value = `В ${RAW_PATH} нет строк для SSE-обновления.`
    return
  }

  const first = rows[0]
  if (!first || typeof first !== 'object' || Array.isArray(first)) {
    errorMessage.value = 'Первая raw-строка имеет неподдерживаемую форму.'
    return
  }

  const id = (first as Record<string, unknown>).id
  if ((typeof id !== 'string' && typeof id !== 'number') || String(id).length === 0) {
    errorMessage.value = 'У первой raw-строки отсутствует primitive id; keyed SSE update невозможен.'
    return
  }

  isApplyingSSE.value = true
  errorMessage.value = null
  try {
    sseRevision += 1
    const previousFlightNumber = String((first as Record<string, unknown>).flightNumber ?? '')
    const nextFlightNumber = `SSE-${sseRevision}-${new Date().toLocaleTimeString('ru-RU')}`
    const mutationPath = `${RAW_PATH}[id=${JSON.stringify(id)}].flightNumber`

    // Принципиально изменяем только source branch. queries.schedule.table здесь не трогаем:
    // его должен синхронно обновить collectionByKey derive, созданный QueryRuntimeHost.
    Raph.set(mutationPath, nextFlightNumber)
    refreshSnapshots()

    const projected = readRowById(tableSnapshot.value, id)
    if (projected?.flightNumber !== nextFlightNumber) {
      throw new Error(
        `Derived DataView не обновил ${TABLE_PATH} после mutation ${mutationPath}.`,
      )
    }

    lastAction.value = `SSE изменил номер первого рейса: "${previousFlightNumber}" → "${nextFlightNumber}"; table обновлён через Raph Derived.`
  }
  catch (error) {
    errorMessage.value = toErrorMessage(error)
  }
  finally {
    isApplyingSSE.value = false
  }
}

function destroyComposition(): void {
  detachStoreWatchers()
  session.value?.unmount()
  session.value = null
  rawSnapshot.value = undefined
  tableSnapshot.value = undefined
  derivedSnapshot.value = null
}

function assertDomainEntities(): void {
  if (!Endge.domain.getQuery(QUERY_IDENTITY)) {
    throw new Error(`Query "${QUERY_IDENTITY}" не найден в Endge.domain.`)
  }
  if (!Endge.domain.getComponentSFC(COMPONENT_IDENTITY)) {
    throw new Error(`Component SFC "${COMPONENT_IDENTITY}" не найден в Endge.domain.`)
  }
  if (!Endge.domain.getComposition(COMPOSITION_IDENTITY)) {
    throw new Error(`Composition "${COMPOSITION_IDENTITY}" не найдена в Endge.domain.`)
  }
}

function compileTestArtifacts(): void {
  const filter = Endge.domain.getFilter(QUERY_IDENTITY)
  const query = Endge.domain.getQuery(QUERY_IDENTITY)
  const composition = Endge.domain.getComposition(COMPOSITION_IDENTITY)

  if (filter) {
    assertValidArtifact('Filter', QUERY_IDENTITY, Endge.compiler.buildFilter(filter))
  }
  if (query) {
    assertValidArtifact('Query', QUERY_IDENTITY, Endge.compiler.buildQuery(query))
  }

  const componentArtifact = Endge.program.getArtifact('component-sfc', COMPONENT_IDENTITY)
  assertValidArtifact('Component SFC', COMPONENT_IDENTITY, componentArtifact)

  if (composition) {
    assertValidArtifact(
      'Composition',
      COMPOSITION_IDENTITY,
      Endge.compiler.buildComposition(composition),
    )
  }
}

function assertValidArtifact(
  entityType: string,
  identity: string,
  artifact: { status: string, diagnostics?: Array<{ severity?: string, message?: string }> } | null,
): void {
  if (!artifact) {
    throw new Error(`${entityType} "${identity}" не собран в Endge.program.`)
  }
  if (artifact.status !== 'error') {
    return
  }

  const details = artifact.diagnostics
    ?.filter(item => item.severity === 'error')
    .map(item => item.message)
    .filter(Boolean)
    .join('\n')
  throw new Error(`${entityType} "${identity}" содержит compile errors.${details ? `\n${details}` : ''}`)
}

function attachStoreWatchers(): void {
  detachStoreWatchers()
  storeUnsubscribers = [
    Raph.watch(RAW_PATH, refreshSnapshots),
    Raph.watch(`${RAW_PATH}.*`, refreshSnapshots),
    Raph.watch(TABLE_PATH, refreshSnapshots),
    Raph.watch(`${TABLE_PATH}.*`, refreshSnapshots),
  ]
}

function detachStoreWatchers(): void {
  for (const unsubscribe of storeUnsubscribers) {
    unsubscribe()
  }
  storeUnsubscribers = []
}

function refreshSnapshots(): void {
  rawSnapshot.value = cloneValue(Raph.get(RAW_PATH))
  tableSnapshot.value = cloneValue(Raph.get(TABLE_PATH))

  const node = queryRuntime.value?.node?.children.find(child => child instanceof RaphDerivedNode)
  derivedSnapshot.value = node instanceof RaphDerivedNode
    ? { ...node.snapshot() }
    : null
}

function firstRow(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value)) {
    return null
  }
  const row = value[0]
  return row && typeof row === 'object' && !Array.isArray(row)
    ? row as Record<string, unknown>
    : null
}

function readRowById(value: unknown, id: string | number): Record<string, unknown> | null {
  if (!Array.isArray(value)) {
    return null
  }
  const row = value.find(item => item && typeof item === 'object' && (item as Record<string, unknown>).id === id)
  return row && typeof row === 'object'
    ? row as Record<string, unknown>
    : null
}

function cloneValue(value: unknown): unknown {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    }
    catch {}
  }
  return value
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

onMounted(() => {
  void mountComposition()
})

onBeforeUnmount(() => {
  destroyComposition()
})
</script>

<template>
  <main class="flex h-full min-h-0 flex-col gap-4 p-6">
    <header class="flex flex-wrap items-center gap-3">
      <button
        class="rounded border bg-background px-3 py-2 hover:bg-muted disabled:opacity-50"
        type="button"
        :disabled="isMounting"
        @click="mountComposition"
      >
        {{ isMounting ? UI_TEXT.mounting : UI_TEXT.mount }}
      </button>

      <button
        class="rounded border bg-background px-3 py-2 hover:bg-muted disabled:opacity-50"
        type="button"
        :disabled="!queryRuntime || isRunningQuery"
        @click="runQuery"
      >
        {{ isRunningQuery ? UI_TEXT.querying : UI_TEXT.query }}
      </button>

      <button
        class="rounded border border-sky-600 bg-sky-600 px-3 py-2 text-white hover:bg-sky-700 disabled:opacity-50"
        type="button"
        :disabled="!queryRuntime || !hasRawRows || isApplyingSSE"
        @click="emulateSSEUpdate"
      >
        {{ isApplyingSSE ? UI_TEXT.applyingSSE : UI_TEXT.emulateSSE }}
      </button>

      <button
        class="rounded border bg-background px-3 py-2 hover:bg-muted disabled:opacity-50"
        type="button"
        :disabled="!compositionRuntime"
        @click="destroyComposition"
      >
        {{ UI_TEXT.stop }}
      </button>
    </header>

    <p class="text-sm text-muted-foreground">
      {{ lastAction }}
    </p>

    <p v-if="errorMessage" class="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <section v-if="compositionRuntime" class="grid min-h-0 flex-1 grid-rows-[minmax(320px,1fr)_auto] gap-4">
      <div class="min-h-0 overflow-hidden rounded border bg-background p-3">
        <SFC_RuntimeRenderer
          v-if="componentRuntime"
          :host="componentRuntime"
          :input="renderInput"
        />
      </div>

      <div class="grid gap-3 text-xs xl:grid-cols-3">
        <article class="min-w-0 rounded border p-3">
          <div class="mb-2 font-semibold">
            {{ UI_TEXT.rawRow }}
          </div>
          <pre class="max-h-48 overflow-auto">{{ firstRawRow }}</pre>
        </article>
        <article class="min-w-0 rounded border p-3">
          <div class="mb-2 font-semibold">
            {{ UI_TEXT.tableRow }}
          </div>
          <pre class="max-h-48 overflow-auto">{{ firstTableRow }}</pre>
        </article>
        <article class="min-w-0 rounded border p-3">
          <div class="mb-2 font-semibold">
            {{ UI_TEXT.derivedNode }}
          </div>
          <pre class="max-h-48 overflow-auto">{{ derivedSnapshot }}</pre>
        </article>
      </div>
    </section>
  </main>
</template>
