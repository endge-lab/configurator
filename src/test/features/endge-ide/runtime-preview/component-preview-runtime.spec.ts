import type { ComponentSFCPreviewProps } from '@endge/core'

import { Raph } from '@endge/raph'
import { afterEach, describe, expect, it } from 'vitest'

import { resolveComponentPreviewInput } from '@/features/endge-ide/services/preview-runtime/component-preview-runtime'

const STORE_PATH = 'test.runtimePreview.store.items'
const LOCAL_PATH = 'test.runtimePreview.local'

describe('проверка Runtime-вход предварительного просмотра компонента', () => {
  afterEach(() => {
    Raph.delete(STORE_PATH)
    Raph.delete(LOCAL_PATH)
  })

  it('сохраняет литеральные definePreviewProps как изолированный локальный вход', () => {
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

  it('материализует fromStore и литеральные props через единый реактивный источник входных данных', () => {
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

  it('требует смонтированный контекст preview для props из fromData', () => {
    expect(() => resolveComponentPreviewInput({
      rows: { type: 'data', store: 'flight-store', path: 'items' },
    }, null, LOCAL_PATH)).toThrow('Preview Store not mounted: "flight-store".')
  })
})
