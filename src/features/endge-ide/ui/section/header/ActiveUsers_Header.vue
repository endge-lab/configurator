<script setup lang="ts">
import { Users } from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { toast } from 'vue-sonner'

const activeCount = ref(0)
const connected = ref(false)

/** Количество остальных (без тебя): при 2+ показываем count − 1. */
const othersCount = computed(() =>
  activeCount.value >= 2 ? activeCount.value - 1 : 0,
)
/** Текст для счётчика: "Только вы" | "С вами 1 человек" | "С вами работают N человек/человека". */
const othersLabel = computed(() => {
  const n = othersCount.value
  if (n === 0) return 'Только вы'
  if (n === 1) return 'С вами 1 человек'
  const mod10 = n % 10
  const mod100 = n % 100
  const word = (mod10 === 1 && mod100 !== 11) ? 'человек' : (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) ? 'человека' : 'человек'
  return `С вами работают ${n} ${word}`
})

const MAX_ATTEMPTS = 3
let _attempt = 0
let _gaveUp = false
let _ws: WebSocket | null = null

function _wsUrl(): string {
  const wsUrl = import.meta.env.VITE_PAYLOAD_WS_URL as string | undefined
  if (wsUrl)
    return wsUrl.startsWith('ws') ? wsUrl : wsUrl.replace(/^http/, 'ws')
  const base = (import.meta.env.VITE_PAYLOAD_BASE_URL as string) || ''
  if (!base)
    return ''
  const u = new URL(base)
  u.protocol = u.protocol.replace('http', 'ws')
  const port = (import.meta.env.VITE_PAYLOAD_WS_PORT as string) || ''
  if (port)
    u.port = port
  const pathname = u.pathname.replace(/\/$/, '')
  if (pathname.endsWith('/api'))
    u.pathname = pathname.replace(/\/api$/, '/bridge')
  else
    u.pathname = `${pathname}/bridge`
  return u.toString()
}

function _setConnected(value: boolean) {
  nextTick(() => { connected.value = value })
}

function _setCount(value: number, prev: number) {
  nextTick(() => {
    if (value > prev && prev > 0) {
      toast.info('В систему вошёл новый пользователь', {
        description: `Сейчас в админке ${value} человек`,
      })
    }
    activeCount.value = value
  })
}

function _connect() {
  const url = _wsUrl()
  console.log('WS URL:', url)
  if (!url || _gaveUp)
    return
  try {
    _ws = new WebSocket(url)
    _ws.onopen = () => {
      _attempt = 0
      _setConnected(true)
    }
    _ws.onclose = () => {
      _setConnected(false)
      if (_gaveUp)
        return
      _ws = null
      _attempt += 1
      if (_attempt >= MAX_ATTEMPTS) {
        _gaveUp = true
        nextTick(() => {
          toast.error('Не удалось подключиться к каналу активных пользователей', {
            description: `Попыток: ${MAX_ATTEMPTS}. Проверьте, что Payload запущен и сокет на порту доступен.`,
          })
        })
        return
      }
      setTimeout(() => _connect(), 1500)
    }
    _ws.onerror = () => {
      _setConnected(false)
    }
    _ws.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { count?: number }
        const newCount = typeof data?.count === 'number' ? data.count : 0
        const prev = activeCount.value
        _setCount(newCount, prev)
      }
      catch {
        nextTick(() => { activeCount.value = 0 })
      }
    }
  }
  catch {
    _setConnected(false)
    _attempt += 1
    if (_attempt >= MAX_ATTEMPTS) {
      _gaveUp = true
      nextTick(() => {
        toast.error('Не удалось подключиться к каналу активных пользователей', {
          description: `Попыток: ${MAX_ATTEMPTS}.`,
        })
      })
    }
    else {
      setTimeout(() => _connect(), 1500)
    }
  }
}

onMounted(() => {
  // _connect()
})

onUnmounted(() => {
  _gaveUp = true
  if (_ws) {
    _ws.close()
    _ws = null
  }
  _setConnected(false)
})
</script>

<template>
  <div
    v-if="activeCount >= 0"
    class="flex items-center gap-1.5 rounded-full bg-muted/80 px-2.5 py-1 text-xs text-muted-foreground transition-colors"
    title="Активные пользователи в системе"
  >
    <span
      class="relative flex h-2 w-2"
      :class="connected ? 'text-emerald-500' : 'text-muted-foreground'"
    >
      <span
        v-if="connected"
        class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"
      />
      <span class="relative inline-flex h-2 w-2 rounded-full bg-current" />
    </span>
    <Users class="h-3.5 w-3.5 shrink-0" />
    <span class="font-medium tabular-nums">
      {{ othersLabel }}
    </span>
  </div>
</template>
