import type { MaybeRef } from 'vue'

import { DurationFormat } from '@formatjs/intl-durationformat'
import { parse as parseISO8601, toSeconds } from 'iso8601-duration'
import { computed, defineComponent, onMounted, onUnmounted, ref, unref, watch } from 'vue'

import { i18n } from '@/i18n'

const { locale } = i18n.global

// Кеширование экземпляров DurationFormat по локали для производительности
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
 * Разбирает строку длительности ISO8601, например "PT1H30M" или "P1DT2H30M15S".
 * Возвращает длительность в миллисекундах.
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
 * Преобразует значение даты во временную метку.
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
 * Форматирует длительность в миллисекундах в удобочитаемую строку.
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

  // Формирование объекта длительности для DurationFormat
  const duration: Record<string, number> = {}

  if (years > 0) {
    duration.years = years
  }
  if (months > 0) {
    duration.months = months
  }
  if (days > 0 && years === 0) {
    duration.days = days
  }
  if (hours > 0 && totalMonths === 0) {
    duration.hours = hours
  }
  if (minutes > 0 && totalDays === 0) {
    duration.minutes = minutes
  }
  if (seconds > 0 && totalHours === 0) {
    duration.seconds = seconds
  }

  // Если компоненты длительности отсутствуют, показываем 0 секунд
  if (Object.keys(duration).length === 0) {
    duration.seconds = 0
  }

  const formatter = getFormatter(lang)
  const result = formatter.format(duration)

  return isNegative ? `-${result}` : result
}

/**
 * Возвращает отформатированную строку длительности.
 * @param durationOrStart - строка длительности ISO8601 или дата начала
 * @param endOrOptions - дата окончания (необязательно, по умолчанию текущее время) либо настройки, если первый параметр имеет формат ISO8601
 * @param options - настройки (используются только когда endOrOptions является датой)
 */
export function getDuration(
  durationOrStart: string | Date | number,
  endOrOptions?: Date | number | string | GetDurationOptions,
  options?: GetDurationOptions,
): string {
  let durationMs: number
  let opts: GetDurationOptions

  // Проверяем, является ли первый параметр строкой длительности ISO8601
  if (typeof durationOrStart === 'string' && durationOrStart.startsWith('P')) {
    durationMs = parseISO8601Duration(durationOrStart)
    opts = (endOrOptions as GetDurationOptions) || {}
  }
  else {
    // Вычисляем длительность по датам начала и окончания
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
 * Реактивный composable для длительности.
 * @param durationOrStart - строка длительности ISO8601 или дата начала (может быть реактивной)
 * @param endOrOptions - дата окончания (необязательно, по умолчанию текущее время, может быть реактивной) либо настройки, если первый параметр имеет формат ISO8601
 * @param options - настройки (используются только когда endOrOptions является датой)
 */
export function useDuration(
  durationOrStart: MaybeRef<string | Date | number>,
  endOrOptions?: MaybeRef<Date | number | string | undefined> | GetDurationOptions,
  options?: GetDurationOptions,
) {
  // Реактивный триггер для обновления длительности в реальном времени
  const updateTrigger = ref(0)

  const value = computed(() => {
    // Access updateTrigger to make this computed reactive to manual updates
    void updateTrigger.value

    const start = unref(durationOrStart)
    const endOrOpts = unref(endOrOptions)

    // Проверяем, является ли первый параметр строкой длительности ISO8601
    if (typeof start === 'string' && start.startsWith('P')) {
      return getDuration(start, endOrOpts as GetDurationOptions)
    }
    else {
      // Если дата окончания не передана, используем текущее время
      if (endOrOpts === undefined || (typeof endOrOpts === 'object' && !('getTime' in endOrOpts) && !('lang' in endOrOpts))) {
        return getDuration(start, Date.now(), options)
      }
      return getDuration(start, endOrOpts as Date | number | string, options)
    }
  })

  let timer: ReturnType<typeof setTimeout> | null = null

  function scheduleUpdate() {
    const start = unref(durationOrStart)

    // Планируем обновления только при вычислении по датам, а не по строке ISO8601
    if (typeof start === 'string' && start.startsWith('P')) {
      return
    }

    const endOrOpts = unref(endOrOptions)

    // Автоматически обновляем только при отсутствии даты окончания, когда используется текущее время
    if (endOrOpts === undefined || (typeof endOrOpts === 'object' && 'lang' in endOrOpts)) {
      // Обновляем каждую секунду для отображения актуальной длительности
      timer = setTimeout(update, 1000)
    }
  }

  function update() {
    // Запускаем повторное вычисление обновлением реактивного триггера
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
 * Компонент отображения длительности.
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

    // Выбираем режим по переданным props
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
        // Для длительности ISO8601 второй параметр содержит настройки
        return options.value
      }
      else {
        // Для дат начала и окончания второй параметр содержит дату окончания и может быть undefined
        // При undefined useDuration использует текущее время и автоматически обновляет значение
        return props.end !== undefined ? props.end : undefined
      }
    })

    // При использовании дат начала и окончания передаём настройки третьим параметром
    const value = props.duration
      ? useDuration(durationOrStart.value, endOrOptions.value)
      : useDuration(durationOrStart.value, endOrOptions.value, options.value)

    return () => value.value
  },
})
