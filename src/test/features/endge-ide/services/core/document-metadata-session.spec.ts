import { QueryType } from '@endge/core'
import { describe, expect, it } from 'vitest'

import { DocumentMetadataSession } from '@/features/endge-ide/services/document-metadata-session'

describe('document metadata session', () => {
  it('keeps a draft dirty until persistence accepts the prepared Source', () => {
    const model = { source: `defineQuery({ kind: 'rest', request: { url: '/' }, outputs: {} })`, meta: {} }
    const editor = {
      source: model.source,
      applySourceText(source: string) {
        this.source = source
      },
    }
    const session = new DocumentMetadataSession(QueryType.REST, editor, model)

    session.updateDraft('{"company.feature":{"owner":"operations"}}')
    expect(session.dirty).toBe(true)
    expect(session.prepareBeforeSave()).toBe(true)
    expect(editor.source).toContain('metadata: {')
    expect(model.meta).toEqual({})
    expect(session.dirty).toBe(true)

    model.source = editor.source
    session.acceptSaved()
    expect(session.dirty).toBe(false)
  })

  it('preserves an invalid draft when Source changes externally and blocks save', () => {
    const editor = { source: `defineType({ identity: field(String) })` }
    const session = new DocumentMetadataSession('type', editor, editor)

    session.updateDraft('{')
    editor.source = `defineType({ identity: field(Number) })`
    session.refreshFromDocument()

    expect(session.draft).toBe('{')
    expect(session.error).not.toBeNull()
    expect(session.prepareBeforeSave()).toBe(false)
  })

  it('merges entity-backed metadata without replacing system siblings', () => {
    const model = {
      meta: {
        configurator: { section: 'general' },
        endge: { navigation: true },
      },
    }
    const session = new DocumentMetadataSession('navigation', model, model)

    session.updateDraft('{"company.feature":{"owner":"operations"}}')
    expect(session.prepareBeforeSave()).toBe(true)
    expect(model.meta).toEqual({
      configurator: { section: 'general' },
      endge: { navigation: true },
      user: { 'company.feature': { owner: 'operations' } },
    })
  })

  it('does not apply a dirty draft for a read-only document', () => {
    const document = { meta: {} }
    const session = new DocumentMetadataSession('workspace', document, document, true)

    session.updateDraft('{"owner":"operations"}')
    expect(session.prepareBeforeSave()).toBe(false)
    expect(document.meta).toEqual({})
  })

  it('keeps projection diagnostics separate from draft validation', () => {
    const document = {
      source: `defineType({ identity: field(String) })\ndefineMetadata({ owner: 'first' })\ndefineMetadata({ owner: 'second' })`,
    }
    const session = new DocumentMetadataSession('type', document, document)

    expect(session.projection.mode).toBe('duplicate')
    expect(session.projection.editable).toBe(false)
    expect(session.projection.message).not.toBeNull()
    expect(session.error).toBeNull()
    expect(session.dirty).toBe(false)
    expect(session.prepareBeforeSave()).toBe(true)
  })
})
