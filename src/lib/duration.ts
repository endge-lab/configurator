import type { MaybeRef } from 'vue'

import { DurationFormat } from '@formatjs/intl-durationformat'
import { parse as parseISO8601, toSeconds } from 'iso8601-duration'
import { computed, defineComponent, onMounted, onUnmounted, ref, unref, watch } from 'vue'

import { i18n } from '@/i18n'

const { locale } = i18n.global

// Cache DurationFormat instances by locale for performance
const formatterCache = new Map<string, DurationFormat>()

function getFormatter(lang: string): DurationFormat {
  if (!formatterCache.has(lang)) {
    formatterCache.set(lang, new DurationFormat(lang, { style: 'long' }))
  }
  return formatterCache.get(lang)!
}

export interface GetDurationOptions {
  lang?: string
}

/**
 * Parse ISO8601 duration string (e.g., "PT1H30M", "P1DT2H30M15S")
 * Returns duration in milliseconds
 */
function parseISO8601Duration(duration: string): number {
  try {
    const parsed = parseISO8601(duration)
    const seconds = toSeconds(parsed)
    return seconds * 1000
  }
  catch (error) {
    throw new Error(`Invalid ISO8601 duration string: ${error}`)
  }
}

/**
 * Convert date-like value to timestamp
 */
function toTimestamp(date: Date | number | string): number {
  if (typeof date === 'string') {
    const parsed = new Date(date)
    if (Number.isNaN(parsed.getTime())) {
      throw new TypeError('Invalid date string')
    }
    return parsed.getTime()
  }
  else if (typeof date === 'number') {
    return date
  }
  else {
    return date.getTime()
  }
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(durationMs: number, lang: string): string {
  const absMs = Math.abs(durationMs)
  const isNegative = durationMs < 0

  const totalSeconds = Math.floor(absMs / 1000)
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const totalHours = Math.floor(totalMinutes / 60)
  const hours = totalHours % 24
  const totalDays = Math.floor(totalHours / 24)
  const days = totalDays % 30
  const totalMonths = Math.floor(totalDays / 30)
  const months = totalMonths % 12
  const years = Math.floor(totalMonths / 12)

  // Build duration object for DurationFormat
  const duration: Record<string, number> = {}

  if (years > 0)
    duration.years = years
  if (months > 0)
    duration.months = months
  if (days > 0 && years === 0)
    duration.days = days
  if (hours > 0 && totalMonths === 0)
    duration.hours = hours
  if (minutes > 0 && totalDays === 0)
    duration.minutes = minutes
  if (seconds > 0 && totalHours === 0)
    duration.seconds = seconds

  // If no duration components, show 0 seconds
  if (Object.keys(duration).length === 0) {
    duration.seconds = 0
  }

  const formatter = getFormatter(lang)
  const result = formatter.format(duration)

  return isNegative ? `-${result}` : result
}

/**
 * Get formatted duration string
 * @param durationOrStart - ISO8601 duration string or start date
 * @param endOrOptions - End date (optional, defaults to now) or options if first param is ISO8601
 * @param options - Options (only used when endOrOptions is a date)
 */
export function getDuration(
  durationOrStart: string | Date | number,
  endOrOptions?: Date | number | string | GetDurationOptions,
  options?: GetDurationOptions,
): string {
  let durationMs: number
  let opts: GetDurationOptions

  // Check if first parameter is ISO8601 duration string
  if (typeof durationOrStart === 'string' && durationOrStart.startsWith('P')) {
    durationMs = parseISO8601Duration(durationOrStart)
    opts = (endOrOptions as GetDurationOptions) || {}
  }
  else {
    // Calculate duration from start and end dates
    const startMs = toTimestamp(durationOrStart)
    const endMs = (endOrOptions && typeof endOrOptions !== 'object') || endOrOptions instanceof Date
      ? toTimestamp(endOrOptions as Date | number | string)
      : Date.now()
    durationMs = endMs - startMs
    opts = (typeof endOrOptions === 'object' && !(endOrOptions instanceof Date) ? endOrOptions : options) || {}
  }

  const { lang = locale.value } = opts

  return formatDuration(durationMs, lang)
}

/**
 * Reactive duration composable
 * @param durationOrStart - ISO8601 duration string or start date (can be reactive)
 * @param endOrOptions - End date (optional, defaults to now, can be reactive) or options if first param is ISO8601
 * @param options - Options (only used when endOrOptions is a date)
 */
export function useDuration(
  durationOrStart: MaybeRef<string | Date | number>,
  endOrOptions?: MaybeRef<Date | number | string | undefined> | GetDurationOptions,
  options?: GetDurationOptions,
) {
  // Reactive trigger for live duration updates
  const updateTrigger = ref(0)

  const value = computed(() => {
    // Access updateTrigger to make this computed reactive to manual updates
    void updateTrigger.value

    const start = unref(durationOrStart)
    const endOrOpts = unref(endOrOptions)

    // Check if first parameter is ISO8601 duration string
    if (typeof start === 'string' && start.startsWith('P')) {
      return getDuration(start, endOrOpts as GetDurationOptions)
    }
    else {
      // If end is not provided or is undefined, use current time
      if (endOrOpts === undefined || (typeof endOrOpts === 'object' && !('getTime' in endOrOpts) && !('lang' in endOrOpts))) {
        return getDuration(start, Date.now(), options)
      }
      return getDuration(start, endOrOpts as Date | number | string, options)
    }
  })

  let timer: ReturnType<typeof setTimeout> | null = null

  function scheduleUpdate() {
    const start = unref(durationOrStart)

    // Only schedule updates if we're calculating from dates (not ISO8601 string)
    if (typeof start === 'string' && start.startsWith('P')) {
      return
    }

    const endOrOpts = unref(endOrOptions)

    // Only auto-update if end date is not provided (using current time)
    if (endOrOpts === undefined || (typeof endOrOpts === 'object' && 'lang' in endOrOpts)) {
      // Update every second for live duration
      timer = setTimeout(update, 1000)
    }
  }

  function update() {
    // Trigger recomputation by updating the reactive trigger
    updateTrigger.value++
    scheduleUpdate()
  }

  onMounted(() => {
    scheduleUpdate()
  })

  onUnmounted(() => {
    if (timer) {
      clearTimeout(timer)
    }
  })

  watch(
    () => [unref(durationOrStart), unref(endOrOptions), options?.lang],
    () => {
      if (timer) {
        clearTimeout(timer)
      }
      scheduleUpdate()
    },
    { deep: true },
  )

  return value
}

/**
 * Duration component
 */
export const Duration = defineComponent({
  name: 'Duration',
  props: {
    duration: {
      type: String,
      default: undefined,
    },
    start: {
      type: [Date, Number, String],
      default: undefined,
    },
    end: {
      type: [Date, Number, String],
      default: undefined,
    },
    lang: {
      type: String,
      default: undefined,
    },
  },
  setup(props) {
    const options = computed(() => ({
      lang: props.lang,
    }))

    // Determine which mode to use based on props
    const durationOrStart = computed(() => {
      if (props.duration) {
        return props.duration
      }
      else if (props.start) {
        return props.start
      }
      else {
        throw new Error('Either duration or start prop must be provided')
      }
    })

    const endOrOptions = computed(() => {
      if (props.duration) {
        // For ISO8601 duration, second param is options
        return options.value
      }
      else {
        // For start/end dates, second param is end date (can be undefined)
        // When undefined, useDuration will use current time and auto-update
        return props.end !== undefined ? props.end : undefined
      }
    })

    // When using start/end dates, pass options as third parameter
    const value = props.duration
      ? useDuration(durationOrStart.value, endOrOptions.value)
      : useDuration(durationOrStart.value, endOrOptions.value, options.value)

    return () => value.value
  },
})
