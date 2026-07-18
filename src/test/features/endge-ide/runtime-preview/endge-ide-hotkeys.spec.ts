import { describe, expect, it } from 'vitest'

import { REGISTERED_HOTKEYS } from '@/features/endge-ide/model/core/endge-ide-hotkeys'

describe('endgeIDE Runtime Preview hotkeys', () => {
  it('registers cross-platform runtime launch and project return shortcuts', () => {
    expect(REGISTERED_HOTKEYS).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'runRuntime', keys: ['ctrl+enter', 'meta+enter'] }),
      expect.objectContaining({ action: 'returnToProject', keys: 'escape' }),
    ]))
  })
})
