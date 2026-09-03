// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  EndgeIDEHotkeys_Module,
  isCloseTabShortcut,
  REGISTERED_HOTKEYS,
} from '@/features/endge-ide/modules/EndgeIDEHotkeys_Module'

describe('endgeIDE workspace hotkeys', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('registers cross-platform runtime launch and shared project return shortcuts', () => {
    expect(REGISTERED_HOTKEYS).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'runRuntime', keys: ['ctrl+enter', 'meta+enter'] }),
      expect.objectContaining({ action: 'returnToProject', keys: 'escape', label: 'Вернуться к Project' }),
      expect.objectContaining({ action: 'closeTab', keys: ['ctrl+w', 'meta+w'], label: 'Закрыть сохранённую вкладку' }),
    ]))
  })

  it('matches the physical Ctrl/Cmd+W shortcut independently of keyboard layout', () => {
    expect(isCloseTabShortcut({ code: 'KeyW', key: 'w', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false })).toBe(true)
    expect(isCloseTabShortcut({ code: 'KeyW', key: 'W', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false })).toBe(true)
    expect(isCloseTabShortcut({ code: 'KeyW', key: 'ц', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false })).toBe(true)
    expect(isCloseTabShortcut({ code: 'KeyW', key: 'w', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true })).toBe(false)
    expect(isCloseTabShortcut({ code: 'KeyQ', key: 'w', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false })).toBe(false)
  })

  it('returns to Project only for an unconsumed Escape', () => {
    const hotkeys = new EndgeIDEHotkeys_Module()
    const returnToProject = vi.fn(() => true)
    hotkeys.setReturnToProjectHandler(returnToProject)
    hotkeys.init()

    try {
      const editable = document.createElement('div')
      editable.addEventListener('keydown', event => event.preventDefault())
      document.body.append(editable)

      editable.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }))
      expect(returnToProject).not.toHaveBeenCalled()

      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }))
      expect(returnToProject).toHaveBeenCalledOnce()
    }
    finally {
      hotkeys.reset()
    }
  })
})
