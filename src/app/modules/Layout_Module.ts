import type { BreadcrumbItem } from '@/app/domain/types/layout.type'

import { computed, reactive } from 'vue'

/** Владеет состоянием отображения layout приложения, общим для маршрутов. */
export class Layout_Module {
  private readonly _state = reactive({
    breadcrumbs: [] as BreadcrumbItem[],
    breadcrumbsLimit: 3,
  })

  public readonly breadcrumbs = computed(() => this._state.breadcrumbs)
  public readonly breadcrumbsLimit = computed(() => this._state.breadcrumbsLimit)

  public setBreadcrumbs(breadcrumbs: BreadcrumbItem[]): void {
    this._state.breadcrumbs = breadcrumbs
  }

  public setBreadcrumbsLimit(limit: number): void {
    this._state.breadcrumbsLimit = limit
  }

  public reset(): void {
    this._state.breadcrumbs = []
    this._state.breadcrumbsLimit = 3
  }
}
