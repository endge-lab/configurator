import { describe, expect, it } from 'vitest'

import { REGISTERED_HOTKEYS } from '@/features/endge-ide/model/core/endge-ide-hotkeys'

describe('endgeIDE workspace hotkeys', () => {
  it('registers cross-platform runtime launch and shared project return shortcuts', () => {
    expect(REGISTERED_HOTKEYS).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'runRuntime', keys: ['ctrl+enter', 'meta+enter'] }),
      expect.objectContaining({ action: 'returnToProject', keys: 'escape', label: 'Вернуться к Project' }),
    ]))
  })
})
