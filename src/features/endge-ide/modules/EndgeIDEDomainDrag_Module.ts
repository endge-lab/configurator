import type {
  DomainDragState,
  DomainDragTreeItem,
} from '@/features/endge-ide/domain/types/domain-drag.type'

import { ref } from 'vue'

/** Владеет текущим взаимодействием перетаскивания в дереве домена, общим для источников и целей. */
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
