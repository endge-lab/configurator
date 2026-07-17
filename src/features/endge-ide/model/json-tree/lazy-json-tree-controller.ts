import type { InjectionKey, Ref } from 'vue'

export type LazyJsonTreeCommand = 'expand-visible' | 'collapse-all'

export interface LazyJsonTreeController {
  eagerLimit: Ref<number>
  pageSize: Ref<number>
  maxMountedNodes: Ref<number>
  allocatedNodes: Ref<number>
  command: Ref<LazyJsonTreeCommand | null>
  commandRevision: Ref<number>
  notice: Ref<string | null>
}

export const LazyJsonTreeControllerKey: InjectionKey<LazyJsonTreeController> = Symbol('endge.lazy-json-tree-controller')
