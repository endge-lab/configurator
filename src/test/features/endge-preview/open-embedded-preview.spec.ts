import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ENDGE_PREVIEW_RUNTIME_TREE_WIDGET_ID } from '@/features/endge-preview/config/constants'
import {
  embeddedEndgePreviewTarget,
  openEndgeEmbeddedPreview,
} from '@/features/endge-preview/model/navigation/open-embedded-preview'

const { showWidget } = vi.hoisted(() => ({ showWidget: vi.fn() }))

vi.mock('@/components/layouts/grid', () => ({ showWidget }))

describe('openEndgeEmbeddedPreview', () => {
  beforeEach(() => {
    embeddedEndgePreviewTarget.value = null
    showWidget.mockReset()
  })

  it('selects the normalized target and activates Runtime Tree in the current window', () => {
    expect(openEndgeEmbeddedPreview('composition', ' child ')).toBe(true)

    expect(embeddedEndgePreviewTarget.value).toEqual({
      entityType: 'composition',
      identity: 'child',
    })
    expect(showWidget).toHaveBeenCalledOnce()
    expect(showWidget).toHaveBeenCalledWith(ENDGE_PREVIEW_RUNTIME_TREE_WIDGET_ID)
  })

  it('does not switch the workspace without a persisted identity', () => {
    expect(openEndgeEmbeddedPreview('store', ' ')).toBe(false)
    expect(embeddedEndgePreviewTarget.value).toBeNull()
    expect(showWidget).not.toHaveBeenCalled()
  })
})
