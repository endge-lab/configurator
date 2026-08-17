import type {
  DomainDragState,
  DomainDragTreeItem,
} from '@/features/endge-ide/domain/types/domain-drag.type'

import { ref } from 'vue'

/** Owns the current domain-tree drag interaction shared by drag sources and drop targets. */
export class EndgeIDEDomainDrag_Module {
  private readonly _state = ref<DomainDragState>({
    active: false,
    sectionTypes: [],
    tree: [],
  })

  public get state() {
    return this._state
  }

  public start(sectionTypes: string[], tree: DomainDragTreeItem[] = []): void {
    this._state.value = {
      active: true,
      sectionTypes: [...new Set(sectionTypes)],
      tree,
    }
  }

  public reset(): void {
    this._state.value = { active: false, sectionTypes: [], tree: [] }
  }
}
