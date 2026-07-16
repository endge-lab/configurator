import { describe, expect, it } from 'vitest'

import { DocsCategory } from '@/features/endge-ide/domain/types/docs.types'
import { EndgeIDEDocs } from '@/features/endge-ide/model/core/endge-ide-docs'
import { collectSFCStyleEndgeCSSDiagnostics } from '@/features/endge-ide/source-editor/contributions/component-sfc/endgecss.contribution'

describe('EndgeCSS configurator integration', () => {
  it('registers a dedicated six-page documentation category', () => {
    const docs = new EndgeIDEDocs()
    docs.init()
    expect(docs.getEntriesByCategory(DocsCategory.EndgeCSS)).toHaveLength(6)
  })

  it('maps style diagnostics to absolute SFC source offsets', () => {
    const source = '<template><Text /></template>\n<style lang="endgecss">\n@layer base { Text { color: red; } }\n</style>'
    const diagnostics = collectSFCStyleEndgeCSSDiagnostics(source)
    expect(diagnostics[0].message).toContain('@layer')
    expect(source.slice(diagnostics[0].start, diagnostics[0].end)).toContain('@layer')
  })
})
