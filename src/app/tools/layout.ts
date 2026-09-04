import type { MaybeRefOrGetter } from 'vue'
import type { BreadcrumbItem } from '@/app/domain/types/layout.type'

import { onBeforeUnmount, toValue, watch } from 'vue'
import { useRoute } from 'vue-router'

import { Configurator } from '@/app/Configurator'

export type { BreadcrumbItem } from '@/app/domain/types/layout.type'

export interface LayoutOptions {
  breadcrumbs?: MaybeRefOrGetter<BreadcrumbItem[]>
  breadcrumbsLimit?: number
}

export function useLayout(options?: LayoutOptions) {
  const route = useRoute()

  // Применение настроек layout
  const applyLayoutSettings = () => {
    // Установка лимита breadcrumbs либо сброс к значению по умолчанию
    Configurator.layout.setBreadcrumbsLimit(options?.breadcrumbsLimit ?? 3)

    // Установка breadcrumbs, если они переданы
    if (options?.breadcrumbs) {
      const breadcrumbsValue = toValue(options.breadcrumbs)
      if (breadcrumbsValue) {
        Configurator.layout.setBreadcrumbs(breadcrumbsValue)
      }
    }
    else {
      Configurator.layout.setBreadcrumbs([])
    }
  }

  // Немедленное применение настроек
  applyLayoutSettings()

  // Отслеживание смены маршрута и повторное применение настроек
  const stopRouteWatch = watch(
    () => route.fullPath,
    () => {
      applyLayoutSettings()
    },
  )

  // Отслеживание breadcrumbs, если они реактивны
  let stopBreadcrumbsWatch: (() => void) | undefined
  if (options?.breadcrumbs) {
    stopBreadcrumbsWatch = watch(
      () => toValue(options.breadcrumbs),
      (newBreadcrumbs) => {
        if (newBreadcrumbs) {
          Configurator.layout.setBreadcrumbs(newBreadcrumbs)
        }
      },
    )
  }

  // Очистка при размонтировании
  onBeforeUnmount(() => {
    stopRouteWatch()
    stopBreadcrumbsWatch?.()
  })

  return {
    breadcrumbs: Configurator.layout.breadcrumbs,
    breadcrumbsLimit: Configurator.layout.breadcrumbsLimit,
    setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => {
      Configurator.layout.setBreadcrumbs(breadcrumbs)
    },
    setBreadcrumbsLimit: (limit: number) => {
      Configurator.layout.setBreadcrumbsLimit(limit)
    },
    clearBreadcrumbs: () => {
      Configurator.layout.setBreadcrumbs([])
    },
  }
}

// Экспорт состояния для использования в компонентах layout
export function getLayoutState() {
  return {
    breadcrumbs: Configurator.layout.breadcrumbs,
    breadcrumbsLimit: Configurator.layout.breadcrumbsLimit,
  }
}

// Функция сброса для хуков router
export function resetLayout() {
  Configurator.layout.reset()
}
