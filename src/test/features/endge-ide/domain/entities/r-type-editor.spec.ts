import { RType } from '@endge/core'
import { describe, expect, it } from 'vitest'

import { RTypeEditor } from '@/features/endge-ide/domain/entities/RTypeEditor'

describe('RTypeEditor source editing', () => {
  it('persists Type Source as the only structural type definition', () => {
    const model = new RType('PassengerProfile')
    model.identity = 'PassengerProfile'
    model.source = ''

    const editor = new RTypeEditor()
    editor.fillFromSource(model)
    editor.applySourceText(`defineType({ identity: field('String') })`)

    expect(editor.source).toBe(`defineType({ identity: field('String') })`)

    editor.updateSource(model)
    expect(model.source).toBe(`defineType({ identity: field('String') })`)
    expect(model.sourceVersion).toBe(1)
  })
})
