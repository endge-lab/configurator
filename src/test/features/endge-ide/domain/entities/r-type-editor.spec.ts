import { RField, RType } from '@endge/core'
import { describe, expect, it } from 'vitest'

import { RTypeEditor } from '@/features/endge-ide/domain/entities/RTypeEditor'

describe('rTypeEditor staged source migration', () => {
  it('keeps Type Source and legacy fields independent', () => {
    const model = new RType('PassengerProfile')
    model.identity = 'PassengerProfile'
    model.addField(new RField('legacyIdentity', 'String'))
    model.source = ''

    const editor = new RTypeEditor()
    editor.fillFromSource(model)
    editor.applySourceText(`defineType({ identity: field('String') })`)

    expect(editor.fields.map(field => field.name)).toEqual(['legacyIdentity'])

    editor.fields[0]!.name = 'renamedLegacyIdentity'
    expect(editor.source).toBe(`defineType({ identity: field('String') })`)

    editor.updateSource(model)
    expect([...model.fields.keys()]).toEqual(['renamedLegacyIdentity'])
    expect(model.source).toBe(`defineType({ identity: field('String') })`)
    expect(model.sourceVersion).toBe(1)
  })
})
