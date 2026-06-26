import { HotkeyManager } from '@endge/utils'

/** Один пункт горячих клавиш: описание и комбинации для UI и регистрации */
export interface EndgeAdminHotkeyItem {
  /** Описание действия для документации */
  label: string
  /** Комбинации для HotkeyManager: одна строка или массив (например ["ctrl+s", "meta+s"]) */
  keys: string | string[]
  /** Отображаемые клавиши в UI: например "Ctrl+S / ⌘ S" */
  keysLabel: string
  /** Привязка к колбэку; без указания - только лог в консоль */
  action?: 'save' | 'closeTab' | 'createDocument'
}

/** Единый реестр всех горячих клавиш редактора (источник правды для регистрации и документирования) */
export const REGISTERED_HOTKEYS: readonly EndgeAdminHotkeyItem[] = [
  { label: 'Сохранить', keys: ['ctrl+s', 'meta+s'], keysLabel: 'Ctrl+S / ⌘ S', action: 'save' },
  { label: 'Закрыть вкладку', keys: ['ctrl+w', 'meta+w'], keysLabel: 'Ctrl+W / ⌘ W', action: 'closeTab' },
  { label: 'Создать документ', keys: ['ctrl+n', 'meta+n'], keysLabel: 'Ctrl+N / ⌘ N', action: 'createDocument' },
]

/**
 * Подмодуль горячих клавиш Endge Admin.
 * Все комбинации задаются в REGISTERED_HOTKEYS; подписка в init(), отписка в reset().
 */
export class EndgeAdminHotkeys {
  private _manager: HotkeyManager | null = null
  private _onSave: (() => void | Promise<void>) | null = null
  private _onCloseTab: (() => void) | null = null
  private _onCreateDocument: (() => void) | null = null
  private _closeTabCaptureBound: ((e: KeyboardEvent) => void) | null = null
  private _createDocumentCaptureBound: ((e: KeyboardEvent) => void) | null = null

  /** Колбэк сохранения документа. Задаётся из EndgeAdmin.init(). */
  public setSaveHandler(handler: () => void | Promise<void>): void {
    this._onSave = handler
  }

  /** Колбэк закрытия текущей вкладки. Задаётся из EndgeAdmin.init(). */
  public setCloseTabHandler(handler: () => void): void {
    this._onCloseTab = handler
  }

  /** Колбэк открытия модалки создания документа. Задаётся из EndgeAdmin.init(). */
  public setCreateDocumentHandler(handler: () => void): void {
    this._onCreateDocument = handler
  }

  /** Все зарегистрированные горячие клавиши с описаниями (для документирования в UI). */
  public getAllHotkeys(): readonly EndgeAdminHotkeyItem[] {
    return REGISTERED_HOTKEYS
  }

  public init(): void {
    if (this._manager)
      return
    this._manager = new HotkeyManager({ target: window, ignoreInput: true })

    for (const item of REGISTERED_HOTKEYS) {
      const keys = Array.isArray(item.keys) ? item.keys : [item.keys]
      if (item.action === 'save') {
        this._manager.on(keys, (e) => {
          e.preventDefault()
          this._onSave?.()
        })
      }
      else if (item.action === 'closeTab') {
        this._manager.on(keys, (e) => {
          e.preventDefault()
          this._onCloseTab?.()
        })
      }
      else if (item.action === 'createDocument') {
        this._manager.on(keys, (e) => {
          e.preventDefault()
          this._onCreateDocument?.()
        })
      }
      else {
        const label = item.label
        this._manager.on(keys, () => console.log('[EndgeAdminHotkeys]', label))
      }
    }

    // Capture-фаза: перехватываем Cmd+W/Ctrl+W до браузера
    this._closeTabCaptureBound = (e: KeyboardEvent) => {
      if (e.key !== 'w' && e.key !== 'W')
        return
      if (!e.ctrlKey && !e.metaKey)
        return
      e.preventDefault()
      e.stopPropagation()
      this._onCloseTab?.()
    }
    window.addEventListener('keydown', this._closeTabCaptureBound, { capture: true })

    // Capture-фаза: перехватываем Cmd+N/Ctrl+N до браузера (новое окно)
    this._createDocumentCaptureBound = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N')
        return
      if (!e.ctrlKey && !e.metaKey)
        return
      const target = e.target as HTMLElement | null
      if (target?.closest?.('input, textarea, [contenteditable="true"]'))
        return
      e.preventDefault()
      e.stopPropagation()
      this._onCreateDocument?.()
    }
    window.addEventListener('keydown', this._createDocumentCaptureBound, { capture: true })
  }

  public reset(): void {
    if (this._closeTabCaptureBound) {
      window.removeEventListener('keydown', this._closeTabCaptureBound, { capture: true })
      this._closeTabCaptureBound = null
    }
    if (this._createDocumentCaptureBound) {
      window.removeEventListener('keydown', this._createDocumentCaptureBound, { capture: true })
      this._createDocumentCaptureBound = null
    }
    this._onSave = null
    this._onCloseTab = null
    this._onCreateDocument = null
    if (this._manager) {
      this._manager.destroy()
      this._manager = null
    }
  }
}
