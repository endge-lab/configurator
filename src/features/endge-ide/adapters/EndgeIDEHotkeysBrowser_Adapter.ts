import { HotkeyManager } from '@endge/utils'

/** Изолирует browser keyboard и DOM APIs hotkeys-модуля. */
export class EndgeIDEHotkeysBrowser_Adapter {
  /** Создаёт manager глобальных browser hotkeys. */
  public createManager(): HotkeyManager {
    return new HotkeyManager({ target: window, ignoreInput: true })
  }

  /** Подписывает browser keydown listener в нужной event phase. */
  public addKeydown(listener: (event: KeyboardEvent) => void, capture = false): void {
    window.addEventListener('keydown', listener, { capture })
  }

  /** Удаляет ранее установленный browser keydown listener. */
  public removeKeydown(listener: (event: KeyboardEvent) => void, capture = false): void {
    window.removeEventListener('keydown', listener, { capture })
  }

  /** Проверяет, что отдельный editor scope уже владеет shortcut. */
  public hasActiveEditorScope(): boolean {
    return Boolean(document.querySelector('[data-editor-shortcut-scope][data-shortcuts-active="true"]'))
  }
}
