import type { MaybeRef } from 'vue'

import { computed, defineComponent, onMounted, onUnmounted, ref, unref, watch } from 'vue'

import { i18n } from '@/i18n'

const { locale } = i18n.global

const ABSOLUTE_PRESETS: Record<string, number> = {
  'year': 86400 * 365,
  'half-year': 86400 * 182,
  'three-months': 86400 * 90,
  'month': 86400 * 30,
  'two-weeks': 86400 * 14,
  'week': 86400 * 7,
  'three-days': 86400 * 3,
  'day': 86400,
}

export interface GetRelativeTimeOptions {
  lang?: string
  switchToAbsolute?: number | keyof typeof ABSOLUTE_PRESETS
}

export function getRelativeTime(
  date: Date | number | string,
  options: GetRelativeTimeOptions = {},
): string {
  const { lang = locale.value, switchToAbsolute } = options

  if (localStorage.getItem('app:date-format') === 'robot') {
    const d = new Date(date)
    const hours = d.getHours().toString().padStart(2, '0')
    const minutes = d.getMinutes().toString().padStart(2, '0')
    const formatter = new Intl.DateTimeFormat(lang, { day: '2-digit', month: '2-digit', year: 'numeric' })
    const dayMonthYear = formatter.format(d)
    return `${dayMonthYear} ${hours}:${minutes}`
  }

  let timeMs: number
  if (typeof date === 'string') {
    const parsed = new Date(date)
    if (Number.isNaN(parsed.getTime()))
      throw new Error('Invalid date string')
    timeMs = parsed.getTime()
  }
  else if (typeof date === 'number') {
    timeMs = date
  }
  else {
    timeMs = date.getTime()
  }
  const now = Date.now()
  const deltaSeconds = Math.round((timeMs - now) / 1000)

  let absoluteThreshold: number | undefined
  if (typeof switchToAbsolute === 'string') {
    absoluteThreshold = ABSOLUTE_PRESETS[switchToAbsolute]
  }
  else {
    absoluteThreshold = switchToAbsolute
  }

  if (absoluteThreshold !== undefined && Math.abs(deltaSeconds) > absoluteThreshold) {
    const d = new Date(timeMs)
    const nowDate = new Date(now)
    const isSameDay = d.getFullYear() === nowDate.getFullYear() && d.getMonth() === nowDate.getMonth() && d.getDate() === nowDate.getDate()
    const isSameYear = d.getFullYear() === nowDate.getFullYear()
    const hours = d.getHours().toString().padStart(2, '0')
    const minutes = d.getMinutes().toString().padStart(2, '0')
    if (isSameDay) {
      return `${hours}:${minutes}`
    }
    else if (isSameYear) {
      const formatter = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long' })
      const dayMonth = formatter.format(d)
      return `${dayMonth}, ${hours}:${minutes}`
    }
    else {
      const formatter = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' })
      const dayMonthYear = formatter.format(d)
      return `${dayMonthYear}, ${hours}:${minutes}`
    }
  }

  const cutoffs = [60, 3600, 86400, 86400 * 7, 86400 * 30, 86400 * 365, Infinity]
  const units: Intl.RelativeTimeFormatUnit[] = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year']
  const unitIndex = cutoffs.findIndex(cutoff => cutoff > Math.abs(deltaSeconds))
  const divisor = unitIndex ? cutoffs[unitIndex - 1] : 1
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  const value = deltaSeconds / divisor!
  const rounded = value < 0 ? Math.ceil(value) : Math.floor(value)
  return rtf.format(rounded, units[unitIndex]!)
}

export function useRelativeTime(
  date: MaybeRef<Date | number | string>,
  options: GetRelativeTimeOptions = {},
) {
  const value = ref(getRelativeTime(unref(date), options))
  let timer: ReturnType<typeof setTimeout> | null = null

  function scheduleUpdate() {
    let timeMs: number
    const d = unref(date)
    if (typeof d === 'string') {
      const parsed = new Date(d)
      if (Number.isNaN(parsed.getTime()))
        return
      timeMs = parsed.getTime()
    }
    else if (typeof d === 'number') {
      timeMs = d
    }
    else {
      timeMs = d.getTime()
    }
    const now = Date.now()
    const delta = Math.abs(timeMs - now)
    let interval = 60000
    if (delta < 60000)
      interval = 1000
    else if (delta < 3600000)
      interval = 60000
    else if (delta < 86400000)
      interval = 3600000
    else interval = 86400000
    timer = setTimeout(update, interval)
  }

  function update() {
    value.value = getRelativeTime(unref(date), options)
    scheduleUpdate()
  }

  onMounted(() => {
    scheduleUpdate()
  })
  onUnmounted(() => {
    if (timer)
      clearTimeout(timer)
  })
  watch(() => [unref(date), options.lang, options.switchToAbsolute], () => {
    value.value = getRelativeTime(unref(date), options)
    if (timer)
      clearTimeout(timer)
    scheduleUpdate()
  })

  return value
}

export const RelativeTime = defineComponent({
  name: 'RelativeTime',
  props: {
    date: {
      type: [Date, Number, String],
      required: true,
    },
    lang: {
      type: String,
      default: undefined,
    },
    switchToAbsolute: {
      type: [Number, String],
      default: undefined,
    },
  },
  setup(props) {
    const options = computed(() => ({
      lang: props.lang,
      switchToAbsolute: props.switchToAbsolute,
    }))
    const value = useRelativeTime(computed(() => props.date), options.value)
    return () => value.value
  },
})
