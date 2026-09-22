import { describe, expect, it } from 'vitest'

import {
  parseRuntimePreviewHistory,
  runtimePreviewHistoryStorageKey,
} from '@/features/endge-ide/services/runtime-preview/runtime-preview-history'

describe('история Runtime Preview', () => {
  it('сохраняет только валидные уникальные цели runtime в исходном порядке', () => {
    expect(parseRuntimePreviewHistory({
      version: 1,
      targets: [
        { entityType: 'composition', identity: 'entry' },
        { entityType: 'store', identity: ' flights ' },
        { entityType: 'composition', identity: 'entry' },
        { entityType: 'query', identity: 'ignored' },
        { entityType: 'store', identity: '' },
      ],
    })).toEqual([
      { entityType: 'composition', identity: 'entry' },
      { entityType: 'store', identity: 'flights' },
    ])
  })

  it('использует логический ключ внутри scoped Context state', () => {
    expect(runtimePreviewHistoryStorageKey()).toBe('configurator.runtime-preview.history')
  })
})
