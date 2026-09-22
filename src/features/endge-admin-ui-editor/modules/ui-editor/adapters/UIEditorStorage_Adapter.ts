import type { UIEditorStoragePort } from '@/features/endge-admin-ui-editor/modules/ui-editor/domain/types/ui-editor-storage.type'

/** Связывает Module UI-редактора с browser localStorage. */
export class UIEditorStorage_Adapter implements UIEditorStoragePort {
  /** Возвращает первое сохранённое значение из текущего или legacy key. */
  public readFirst(keys: readonly string[]): string | null {
    if (!this._storage) {
      return null
    }
    return keys.map(key => this._storage?.getItem(key) ?? null).find(Boolean) ?? null
  }

  /** Сохраняет сериализованное состояние по canonical key. */
  public write(key: string, value: string): void {
    this._storage?.setItem(key, value)
  }

  /** Возвращает localStorage только в browser environment. */
  private get _storage(): Storage | null {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
      ? window.localStorage
      : null
  }
}
