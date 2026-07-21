import { describe, expect, it } from 'vitest'

import { isCloseTabShortcut, REGISTERED_HOTKEYS } from '@/features/endge-ide/model/core/endge-ide-hotkeys'

describe('endgeIDE workspace hotkeys', () => {
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
})
