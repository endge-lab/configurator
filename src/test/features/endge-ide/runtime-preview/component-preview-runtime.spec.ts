import type { ComponentSFCPreviewProps } from '@endge/core'

import { Raph } from '@endge/raph'
import { afterEach, describe, expect, it } from 'vitest'

import { resolveComponentPreviewInput } from '@/features/endge-ide/model/preview-runtime/component-preview-runtime'

const STORE_PATH = 'test.runtimePreview.store.items'
const LOCAL_PATH = 'test.runtimePreview.local'

describe('component preview runtime input', () => {
  afterEach(() => {
    Raph.delete(STORE_PATH)
    Raph.delete(LOCAL_PATH)
  })

  it('keeps literal definePreviewProps as an isolated local input', () => {
    const previewProps: ComponentSFCPreviewProps = {
      title: 'Flights',
      rows: [{ id: 1, status: 'boarding' }],
    }

    const input = resolveComponentPreviewInput(previewProps, null, LOCAL_PATH)

    expect(input).toEqual({
      kind: 'local',
      props: previewProps,
    })
    expect(input.kind === 'local' && input.props.rows).not.toBe(previewProps.rows)
  })

  it('materializes fromStore and literal props through one reactive input source', () => {
    Raph.set(STORE_PATH, [{ id: 2, status: 'delayed' }])
    const input = resolveComponentPreviewInput({
      rows: { type: 'store', path: STORE_PATH },
      title: 'Flights',
    }, null, LOCAL_PATH)

    expect(input).toEqual({
      kind: 'raph',
      bindings: {
        rows: { path: STORE_PATH, wildcardDynamic: true },
        title: { path: `${LOCAL_PATH}.title`, wildcardDynamic: true },
      },
    })
    expect(Raph.get(STORE_PATH)).toEqual([{ id: 2, status: 'delayed' }])
    expect(Raph.get(`${LOCAL_PATH}.title`)).toBe('Flights')
  })

  it('requires a mounted preview context for fromData props', () => {
    expect(() => resolveComponentPreviewInput({
      rows: { type: 'data', store: 'flight-store', path: 'items' },
    }, null, LOCAL_PATH)).toThrow('Preview Store not mounted: "flight-store".')
  })
})
