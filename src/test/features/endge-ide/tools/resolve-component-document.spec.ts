import { ComponentType, Endge, RComponentSFC, RComponentTable } from '@endge/core'
import { afterEach, describe, expect, it } from 'vitest'

import { resolveComponentDocument } from '@/features/endge-ide/tools/resolve-component-document'

describe('resolveComponentDocument', () => {
  afterEach(() => {
    Endge.domain.reset()
  })

  it('resolves an executable SFC component', () => {
    const component = new RComponentSFC()
    component.id = 71
    component.identity = 'groundhandling-control-table'
    component.name = 'Ground handling control table'
    Endge.domain.addComponentSFC(component)

    expect(resolveComponentDocument(component.identity)).toEqual({
      documentId: component.identity,
      documentType: ComponentType.SFC,
    })
  })

  it('keeps legacy component lookup as a fallback', () => {
    const component = new RComponentTable()
    component.id = 72
    component.identity = 'legacy-table'
    component.name = 'Legacy table'
    component.type = ComponentType.Table
    Endge.domain.addComponent(component)

    expect(resolveComponentDocument(component.identity)).toEqual({
      documentId: component.identity,
      documentType: ComponentType.Table,
    })
  })
})
