import type { CompositionRuntimeHost } from '@endge/core'

import { Endge, RComposition, RQuery } from '@endge/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  compositionPreviewRuntime,
  destroyCompositionPreviewRuntime,
  ensureCompositionRuntimeArtifacts,
  launchCompositionPreview,
} from '../../../../../features/endge-ide/model/composition-preview/composition-preview-state'

describe('composition preview artifacts', () => {
  beforeEach(() => prepareCompilerContext())

  afterEach(async () => {
    await destroyCompositionPreviewRuntime()
    Endge.configuration.reset()
    Endge.program.clear()
    Endge.domain.reset()
    Endge.workspace.reset()
    vi.restoreAllMocks()
  })

  it('builds nested Composition dependencies before the preview owner', () => {
    const query = new RQuery()
    query.id = 1
    query.identity = 'groundhandling-query'
    query.name = 'Ground handling query'
    query.sourceVersion = 2
    query.source = `
defineQuery({
  kind: 'rest',
  request: {
    endpoint: 'https://example.test',
    path: '/groundhandling',
    method: 'POST',
  },
  outputs: {
    raw: output().from(response()),
  },
})
`

    const child = new RComposition()
    child.id = 2
    child.identity = 'groundhandling-default'
    child.name = 'Ground handling requests'
    child.source = `
defineComposition({
  runtimes: {
    query: query('groundhandling-query'),
  },
  outputs: {
    rows: output().fromRuntime('query').select('raw'),
  },
})
`

    Endge.domain.addQuery(query)
    Endge.domain.addComposition(child)

    ensureCompositionRuntimeArtifacts(`
defineComposition({
  runtimes: {
    requests: composition('groundhandling-default'),
  },
})
`, new Set(['groundhandling-page']))

    expect(Endge.program.getQueryArtifact('groundhandling-query')?.status).toBe('valid')
    expect(Endge.program.getCompositionArtifact('groundhandling-default')?.status).toBe('valid')
  })

  it('passes definePreviewProps literals to the preview Composition runtime', async () => {
    vi.spyOn(Endge, 'build').mockResolvedValue(undefined)
    const query = new RQuery()
    query.id = 201
    query.identity = 'preview-noop-query'
    query.name = 'Preview noop query'
    query.sourceVersion = 2
    query.source = `
defineQuery({
  kind: 'rest',
  request: {
    endpoint: 'https://example.test',
    path: '/noop',
    method: 'GET',
  },
  outputs: {
    raw: output().from(response()),
  },
})
`
    Endge.domain.addQuery(query)

    await launchCompositionPreview({
      identity: 'preview-props-composition',
      source: `
defineComposition({
  props: defineProps({
    label: field('String'),
  }),
  previewProps: definePreviewProps({
    label: 'Preview label',
  }),
  runtimes: {
    query: query('preview-noop-query'),
  },
})
`,
    })

    expect(compositionPreviewRuntime.value?.getProps()).toEqual({
      label: 'Preview label',
    })
  })

  it('uses nested Composition preview props without changing the authored parent source', async () => {
    vi.spyOn(Endge, 'build').mockResolvedValue(undefined)
    const child = new RComposition()
    child.id = 301
    child.identity = 'groundhandling-query-general'
    child.name = 'Ground handling query general'
    child.source = `
defineComposition({
  props: defineProps({
    requirements: field('Object'),
  }),
  previewProps: definePreviewProps({
    requirements: {
      arrival: { attributes: ['STA'] },
      departure: { attributes: ['STD'] },
    },
  }),
  runtimes: {},
})
`
    Endge.domain.addComposition(child)
    const parentSource = `
defineComposition({
  runtimes: {
    requests: composition('groundhandling-query-general'),
  },
})
`

    await launchCompositionPreview({
      identity: 'groundhandling-page',
      source: parentSource,
    })

    const childRuntime = compositionPreviewRuntime.value?.getChild('requests') as CompositionRuntimeHost | null
    expect(childRuntime?.getProps()).toEqual({
      requirements: {
        arrival: { attributes: ['STA'] },
        departure: { attributes: ['STD'] },
      },
    })
    expect(child.source).not.toContain('.withProps(')
    expect(parentSource).not.toContain('.withProps(')
  })
})

function prepareCompilerContext(): void {
  Endge.workspace.apply({
    identity: 'preview-workspace',
    displayName: 'Preview Workspace',
    configuration: {
      vars: [],
      locales: [{ code: 'en', displayName: 'English', shortLabel: 'EN', direction: 'ltr' }],
      defaultLocale: 'en',
      fallbackLocale: 'en',
      themes: [{ identity: 'light', displayName: 'Light' }],
      defaultTheme: 'light',
      defaultAuthProfileIdentity: null,
      sfcAdapterIds: ['native-vue'],
      defaultSfcAdapterId: 'native-vue',
    },
  })
  Endge.domain.addProject({
    id: 101,
    identity: 'preview-project',
    allowedEnvironmentIds: [],
    configuration: { mode: 'inherit', patch: {} },
  } as any)
  Endge.domain.addEnvironment({
    id: 102,
    identity: 'preview-environment',
    configuration: { mode: 'inherit', patch: {} },
  } as any)
  Endge.domain.addTenant({
    id: 103,
    identity: 'preview-tenant',
    code: 'preview-tenant',
    configuration: { mode: 'inherit', patch: {} },
  } as any)
  Endge.configuration.build({
    dataProvider: 'plain',
    scope: {},
    vars: {},
    context: {
      projectIdentity: 'preview-project',
      environmentIdentity: 'preview-environment',
      tenantIdentity: 'preview-tenant',
    },
  })
}
