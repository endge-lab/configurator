import type { HotkeyManager } from '@endge/utils'
import { EndgeIDEHotkeysBrowser_Adapter } from '@/features/endge-ide/adapters/EndgeIDEHotkeysBrowser_Adapter'

/** Один пункт горячих клавиш: описание и комбинации для UI и регистрации */
export interface EndgeIDEHotkeyItem {
  /** Описание действия для документации */
  label: string
  /** Комбинации для HotkeyManager: одна строка или массив (например ["ctrl+s", "meta+s"]) */
  keys: string | string[]
  /** Отображаемые клавиши в UI: например "Ctrl+S / ⌘ S" */
  keysLabel: string
  /** Привязка к колбэку; без указания - только лог в консоль */
  action?: 'save' | 'closeTab' | 'createDocument' | 'runRuntime' | 'returnToProject'
}

/** Единый реестр всех горячих клавиш редактора (источник правды для регистрации и документирования) */
export const REGISTERED_HOTKEYS: readonly EndgeIDEHotkeyItem[] = [
  { label: 'Сохранить', keys: ['ctrl+s', 'meta+s'], keysLabel: 'Ctrl+S / ⌘ S', action: 'save' },
  { label: 'Закрыть сохранённую вкладку', keys: ['ctrl+w', 'meta+w'], keysLabel: 'Ctrl+W / ⌘ W', action: 'closeTab' },
  { label: 'Создать документ', keys: ['ctrl+n', 'meta+n'], keysLabel: 'Ctrl+N / ⌘ N', action: 'createDocument' },
  { label: 'Запустить Runtime Preview', keys: ['ctrl+enter', 'meta+enter'], keysLabel: 'Ctrl+Enter / ⌘ Enter', action: 'runRuntime' },
  { label: 'Вернуться к Project', keys: 'escape', keysLabel: 'Esc', action: 'returnToProject' },
]

export function isCloseTabShortcut(event: Pick<KeyboardEvent, 'altKey' | 'code' | 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey'>): boolean {
  const isPhysicalW = event.code === 'KeyW'
    || (!event.code && (event.key === 'w' || event.key === 'W'))
  return isPhysicalW
    && (event.ctrlKey || event.metaKey)
    && !event.altKey
    && !event.shiftKey
}

/**
 * Подмодуль горячих клавиш Endge IDE.
 * Все комбинации задаются в REGISTERED_HOTKEYS; подписка в init(), отписка в reset().
 */
export class EndgeIDEHotkeys_Module {
  /** Hotkey manager, browser adapter и lifecycle callbacks. */
  private readonly _browser: EndgeIDEHotkeysBrowser_Adapter
  private _manager: HotkeyManager | null = null
  private _onSave: (() => void | Promise<void>) | null = null
  private _onCloseTab: (() => void) | null = null
  private _onCreateDocument: (() => void) | null = null
  private _onRunRuntime: (() => boolean) | null = null
  private _onReturnToProject: (() => boolean) | null = null
  private _closeTabCaptureBound: ((e: KeyboardEvent) => void) | null = null
  private _createDocumentCaptureBound: ((e: KeyboardEvent) => void) | null = null
  private _runRuntimeCaptureBound: ((e: KeyboardEvent) => void) | null = null
  private _returnToProjectBound: ((e: KeyboardEvent) => void) | null = null

  /**
   * ----------------------------------------
   * PUBLIC
   * ----------------------------------------
   */

  /** Создаёт hotkeys-модуль с явным browser adapter. */
  public constructor(browser: EndgeIDEHotkeysBrowser_Adapter = new EndgeIDEHotkeysBrowser_Adapter()) {
    this._browser = browser
  }

  /** Колбэк сохранения документа. Задаётся из EndgeIDE.init(). */
  public setSaveHandler(handler: () => void | Promise<void>): void {
    this._onSave = handler
  }

  /** Колбэк закрытия текущей вкладки. Задаётся из EndgeIDE.init(). */
  public setCloseTabHandler(handler: () => void): void {
    this._onCloseTab = handler
  }

  /** Колбэк открытия модалки создания документа. Задаётся из EndgeIDE.init(). */
  public setCreateDocumentHandler(handler: () => void): void {
    this._onCreateDocument = handler
  }

  /** Задаёт handler запуска Runtime Preview. */
  public setRunRuntimeHandler(handler: () => boolean): void {
    this._onRunRuntime = handler
  }

  /** Задаёт handler возврата к текущему Project. */
  public setReturnToProjectHandler(handler: () => boolean): void {
    this._onReturnToProject = handler
  }

  /** Все зарегистрированные горячие клавиши с описаниями (для документирования в UI). */
  public getAllHotkeys(): readonly EndgeIDEHotkeyItem[] {
    return REGISTERED_HOTKEYS
  }

  /** Регистрирует hotkeys и browser listeners на lifecycle IDE. */
  public init(): void {
    if (this._manager) {
      return
    }
    this._manager = this._browser.createManager()

    for (const item of REGISTERED_HOTKEYS) {
      const keys = Array.isArray(item.keys) ? item.keys : [item.keys]
      if (item.action === 'save') {
        this._manager.on(keys, (e) => {
          e.preventDefault()
          this._onSave?.()
        })
      }
      else if (item.action === 'closeTab' || item.action === 'returnToProject') {
        // These shortcuts use dedicated listeners below to preserve their event-phase semantics.
        continue
      }
      else if (item.action === 'createDocument') {
        this._manager.on(keys, (e) => {
          e.preventDefault()
          this._onCreateDocument?.()
        })
      }
      else if (item.action === 'runRuntime') {
        this._manager.on(keys, (e) => {
          if (this._onRunRuntime?.()) {
            e.preventDefault()
          }
        })
      }
    }

    // Capture-фаза: перехватываем Cmd+W/Ctrl+W до браузера
    this._closeTabCaptureBound = (e: KeyboardEvent) => {
      if (!isCloseTabShortcut(e)) {
        return
      }
      e.preventDefault()
      e.stopImmediatePropagation()
      this._onCloseTab?.()
    }
    this._browser.addKeydown(this._closeTabCaptureBound, true)

    // Capture-фаза: перехватываем Cmd+N/Ctrl+N до браузера (новое окно)
    this._createDocumentCaptureBound = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N') {
        return
      }
      if (!e.ctrlKey && !e.metaKey) {
        return
      }
      if (this._browser.hasActiveEditorScope()) {
        return
      }
      const target = e.target as HTMLElement | null
      if (target?.closest?.('input, textarea, [contenteditable="true"]')) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      this._onCreateDocument?.()
    }
    this._browser.addKeydown(this._createDocumentCaptureBound, true)

    // Monaco and other source editors may consume Enter, so runtime launch uses capture phase.
    this._runRuntimeCaptureBound = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || (!e.ctrlKey && !e.metaKey) || e.altKey || e.shiftKey) {
        return
      }
      if (!this._onRunRuntime?.()) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
    }
    this._browser.addKeydown(this._runRuntimeCaptureBound, true)

    // Bubble phase lets dialogs and context menus consume Escape before workspace navigation.
    this._returnToProjectBound = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) {
        return
      }
      if (this._onReturnToProject?.()) {
        e.preventDefault()
      }
    }
    this._browser.addKeydown(this._returnToProjectBound)
  }

  /** Освобождает hotkeys и browser listeners. */
  public reset(): void {
    if (this._closeTabCaptureBound) {
      this._browser.removeKeydown(this._closeTabCaptureBound, true)
      this._closeTabCaptureBound = null
    }
    if (this._createDocumentCaptureBound) {
      this._browser.removeKeydown(this._createDocumentCaptureBound, true)
      this._createDocumentCaptureBound = null
    }
    if (this._runRuntimeCaptureBound) {
      this._browser.removeKeydown(this._runRuntimeCaptureBound, true)
      this._runRuntimeCaptureBound = null
    }
    if (this._returnToProjectBound) {
      this._browser.removeKeydown(this._returnToProjectBound)
      this._returnToProjectBound = null
    }
    this._onSave = null
    this._onCloseTab = null
    this._onCreateDocument = null
    this._onRunRuntime = null
    this._onReturnToProject = null
    if (this._manager) {
      this._manager.destroy()
      this._manager = null
    }
  }
}
