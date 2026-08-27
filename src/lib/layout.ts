import type { MaybeRefOrGetter } from 'vue'
import type { BreadcrumbItem } from '@/app/domain/types/layout.type'

import { onBeforeUnmount, toValue, watch } from 'vue'
import { useRoute } from 'vue-router'

import { Configurator } from '@/app/model/kernel/configurator'

export type { BreadcrumbItem } from '@/app/domain/types/layout.type'

export interface LayoutOptions {
  breadcrumbs?: MaybeRefOrGetter<BreadcrumbItem[]>
  breadcrumbsLimit?: number
}

export function useLayout(options?: LayoutOptions) {
  const route = useRoute()

  // Function to apply layout settings
  const applyLayoutSettings = () => {
    // Set breadcrumbs limit if provided, otherwise reset to default
    Configurator.layout.setBreadcrumbsLimit(options?.breadcrumbsLimit ?? 3)

    // Set breadcrumbs if provided
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

  // Apply settings immediately
  applyLayoutSettings()

  // Watch for route changes and reapply settings
  const stopRouteWatch = watch(
    () => route.fullPath,
    () => {
      applyLayoutSettings()
    },
  )

  // Watch breadcrumbs if they're reactive
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

  // Cleanup on unmount
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

// Export the state for use in layout components
export function getLayoutState() {
  return {
    breadcrumbs: Configurator.layout.breadcrumbs,
    breadcrumbsLimit: Configurator.layout.breadcrumbsLimit,
  }
}

// Reset function for router hooks
export function resetLayout() {
  Configurator.layout.reset()
}
