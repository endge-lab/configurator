import type { MaybeRefOrGetter } from 'vue'

import { useTitle } from '@vueuse/core'
import { computed, onBeforeUnmount, reactive, toValue, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useBranding } from '@/lib/branding'

export interface BreadcrumbItem {
  title: string
  href?: string
}

export interface LayoutOptions {
  title?: MaybeRefOrGetter<string | null | undefined>
  breadcrumbs?: MaybeRefOrGetter<BreadcrumbItem[]>
  breadcrumbsLimit?: number
}

interface LayoutState {
  breadcrumbs: BreadcrumbItem[]
  breadcrumbsLimit: number
}

// Global reactive state for layout
const layoutState = reactive<LayoutState>({
  breadcrumbs: [],
  breadcrumbsLimit: 3,
})

export function useLayout(options?: LayoutOptions) {
  const { currentBranding } = useBranding()
  const route = useRoute()

  // Compute the full title based on the provided title option
  const fullTitle = computed(() => {
    const titleValue = options?.title ? toValue(options.title) : null
    const brandingName = currentBranding.value?.name

    if (titleValue) {
      return `${titleValue} – ${brandingName}`
    }
    return brandingName
  })

  // Set the document title reactively
  useTitle(fullTitle)

  // Function to apply layout settings
  const applyLayoutSettings = () => {
    // Set breadcrumbs limit if provided, otherwise reset to default
    layoutState.breadcrumbsLimit = options?.breadcrumbsLimit ?? 3

    // Set breadcrumbs if provided
    if (options?.breadcrumbs) {
      const breadcrumbsValue = toValue(options.breadcrumbs)
      if (breadcrumbsValue) {
        layoutState.breadcrumbs = breadcrumbsValue
      }
    }
    else {
      layoutState.breadcrumbs = []
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
          layoutState.breadcrumbs = newBreadcrumbs
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
    breadcrumbs: computed(() => layoutState.breadcrumbs),
    breadcrumbsLimit: computed(() => layoutState.breadcrumbsLimit),
    setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => {
      layoutState.breadcrumbs = breadcrumbs
    },
    setBreadcrumbsLimit: (limit: number) => {
      layoutState.breadcrumbsLimit = limit
    },
    clearBreadcrumbs: () => {
      layoutState.breadcrumbs = []
    },
  }
}

// Export the state for use in layout components
export function getLayoutState() {
  return {
    breadcrumbs: computed(() => layoutState.breadcrumbs),
    breadcrumbsLimit: computed(() => layoutState.breadcrumbsLimit),
  }
}

// Reset function for router hooks
export function resetLayout() {
  layoutState.breadcrumbs = []
  layoutState.breadcrumbsLimit = 3
}
