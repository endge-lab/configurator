/**
 * Общая регистра диагностических записей из всех вкладок (по каналу endge-runtime-debug).
 */
import { ref, computed } from 'vue'

const CHANNEL_NAME = 'endge-runtime-debug'
const MAX_RECORDS = 2000

/** Запись из канала (уже сериализованная с вкладки). */
export interface DiagnosticsRegisterRecord {
  id: number
  ts: number
  level: string
  kind: string
  channel?: string
  name?: string
  message?: string
  durMs?: number
  value?: number
  unit?: string
  corr?: { traceId?: string; spanId?: string; parentSpanId?: string }
  attrs?: Record<string, unknown>
  entities?: unknown[]
  context?: Record<string, unknown>
  data?: unknown
  error?: unknown
  payload?: unknown
}

export interface DiagnosticsRegisterEntry {
  tabId: string
  url?: string
  title?: string
  record: DiagnosticsRegisterRecord
  at: number
}

const _entries = ref<DiagnosticsRegisterEntry[]>([])

export const diagnosticsRegisterEntries = computed(() => _entries.value)

export function pushFromChannel(payload: {
  tabId?: string
  url?: string
  title?: string
  record?: Record<string, unknown>
  at?: number
}): void {
  const tabId = String(payload?.tabId ?? '').trim()
  const record = payload?.record
  if (!tabId || !record || typeof record !== 'object')
    return
  const entry: DiagnosticsRegisterEntry = {
    tabId,
    url: payload.url,
    title: payload.title,
    record: record as DiagnosticsRegisterRecord,
    at: payload?.at ?? Date.now(),
  }
  const next = [..._entries.value, entry]
  _entries.value = next.length <= MAX_RECORDS ? next : next.slice(-MAX_RECORDS)
}

export function getRecords(limit?: number, tabId?: string): DiagnosticsRegisterEntry[] {
  let list = _entries.value
  if (tabId != null && String(tabId).trim() !== '')
    list = list.filter(e => e.tabId === tabId)
  if (limit != null && limit > 0)
    list = list.slice(-limit)
  return list
}

export function clearRegister(): void {
  _entries.value = []
}

/** Запуск прослушки канала и накопление diagnostics-record. Вызывать из админки при init. */
let _channel: BroadcastChannel | null = null

export function startDiagnosticsChannelListener(): void {
  if (typeof BroadcastChannel === 'undefined' || _channel != null)
    return
  _channel = new BroadcastChannel(CHANNEL_NAME)
  _channel.addEventListener('message', (e: MessageEvent) => {
    const data = e.data
    if (data?.type === 'diagnostics-record')
      pushFromChannel(data)
  })
}

export function stopDiagnosticsChannelListener(): void {
  if (_channel) {
    _channel.close()
    _channel = null
  }
}
