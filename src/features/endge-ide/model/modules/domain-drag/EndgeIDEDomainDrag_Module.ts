import type {
  DomainDragState,
  DomainDragTreeItem,
  FolderRestoreState,
} from '@/features/endge-ide/domain/types/domain-drag.type'

import { ref } from 'vue'

/** Owns the current domain-tree drag interaction shared by drag sources and drop targets. */
export class EndgeIDEDomainDrag_Module {
  private readonly _state = ref<DomainDragState>({
    active: false,
    sectionTypes: [],
    tree: [],
  })

  private readonly _folderRestoreState = new Map<string, FolderRestoreState>()

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
    this._folderRestoreState.clear()
  }

  public rememberFolderRestore(folderId: string, state: FolderRestoreState): void {
    if (!this._folderRestoreState.has(folderId)) {
      this._folderRestoreState.set(folderId, state)
    }
  }

  public getFolderRestore(folderId: string): FolderRestoreState | null {
    return this._folderRestoreState.get(folderId) ?? null
  }

  public forgetFolderRestore(folderId: string): void {
    this._folderRestoreState.delete(folderId)
  }
}
