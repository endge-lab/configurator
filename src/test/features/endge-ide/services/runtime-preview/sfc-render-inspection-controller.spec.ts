import type { SFCRenderInspectionNodeInput } from '@endge/core'

import { describe, expect, it } from 'vitest'

import { SFCRenderInspectionController } from '@/features/endge-ide/services/runtime-preview/sfc-render-inspection-controller'

describe('контроллер инспекции SFC render', () => {
  it('использует hover, пока live-узел не закреплён, и предоставляет его конкретные данные', async () => {
    const controller = new SFCRenderInspectionController()
    const row = { id: 'SU-100', status: 'boarding' }
    const id = controller.session.registerNode(createNode({
      props: { tone: 'warning' },
      locals: { row, rowKey: row.id, value: row.status },
      bindings: {
        tone: { kind: 'expression', source: 'row.status', reads: ['row.status'], value: 'warning' },
      },
    }))
    await Promise.resolve()

    controller.hover(id)
    expect(controller.activeId.value).toBe(id)
    expect(controller.activeData.value).toMatchObject({
      component: 'flight-table',
      props: { tone: 'warning' },
      locals: { rowKey: 'SU-100', value: 'boarding' },
      bindings: { tone: { source: 'row.status', value: 'warning' } },
    })

    controller.pin(id)
    controller.hover(null)
    expect(controller.activeId.value).toBe(id)
    controller.unpin()
    expect(controller.activeId.value).toBeNull()
    controller.destroy()
  })
})

function createNode(overrides: Partial<SFCRenderInspectionNodeInput> = {}): SFCRenderInspectionNodeInput {
  return {
    runtimeId: 'runtime-1',
    componentIdentity: 'flight-table',
    componentStack: ['flight-table'],
    scope: 'root/row:SU-100/column:status',
    parentId: null,
    nodeId: 'status-badge',
    kind: 'element',
    tag: 'Badge',
    props: {},
    componentProps: { rows: [] },
    locals: {},
    bindings: {},
    ...overrides,
  }
}
