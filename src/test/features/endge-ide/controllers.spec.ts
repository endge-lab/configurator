import type {
  CompositionProgramPayload,
  ControllerDefinition,
  RuntimeArtifactReader,
} from '@endge/core'
import { Endge, RComposition, RQuery, RStore, RUpdate } from '@endge/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildCompositionDependencyTree } from '@/features/endge-ide/services/composition-dependencies/composition-dependency-tree'
import {
  getControllerCatalogDefinitions,
  mergeControllerDefinitions,
  resolveControllerCatalogDefinition,
} from '@/features/endge-ide/services/controllers/controller-catalog'
import { buildRuntimePreviewTree } from '@/features/endge-ide/services/runtime-preview/runtime-preview-tree-builder'
import {
  controllerSourceHint,
  createControllerSourceContribution,
} from '@/features/endge-ide/source-editor/contributions/composition/controllers/controller-source.contribution'
import { collectionWindowBundle } from '@/test/browser/collection-window-documents'

afterEach(() => Endge.domain.reset())

describe('code-owned Controllers in Configurator', () => {
  it('keeps controller catalog metadata and Source hints runtime-only', () => {
    const definition = Endge.runtime.controllers.get(
      'endge.collection-window',
    )!
    expect(definition.origin.kind).toBe('builtin')
    const hint = controllerSourceHint(definition)
    expect(hint).toContain(definition.defaultProviderKey)
    expect(hint).toContain('rowsRevision?: Number')
    expect(hint).toContain('retainRows')
    expect(hint).toContain('state: store')
    expect(hint).toContain('load: query')
    expect(hint).toContain('runtime-only')
  })

  it('shows Store/Update/Query dependencies without inventing a Controller Domain document', () => {
    const bundle = collectionWindowBundle('http://localhost')
    Endge.domain.addStore(
      Object.assign(new RStore(), bundle.documents.stores[0]),
    )
    Endge.domain.addUpdate(
      Object.assign(new RUpdate(), bundle.documents.updates[0]),
    )
    Endge.domain.addQuery(
      Object.assign(new RQuery(), bundle.documents.queries[0]),
    )
    const composition = Object.assign(
      new RComposition(),
      bundle.documents.compositions[0],
    )
    const result = buildCompositionDependencyTree({
      identity: composition.identity,
      source: composition.source,
    })
    expect(result.status).toBe('valid')
    const controller = result.root!.children.find(
      node => node.alias === 'window',
    )!
    expect(controller).toMatchObject({
      identity: 'endge.collection-window',
      documentType: null,
      status: 'valid',
      dataDependencies: ['state'],
    })
    expect(
      controller.children.map(node => ({
        identity: node.identity,
        documentType: node.documentType,
        status: node.status,
      })),
    ).toEqual([
      { identity: 'window-state', documentType: 'store', status: 'valid' },
      { identity: 'window-commit', documentType: 'update', status: 'valid' },
      { identity: 'window-page', documentType: 'query-rest', status: 'valid' },
    ])
  })

  it('projects controller lifecycle in Preview with no persisted document target', () => {
    const document = Object.assign(
      new RComposition(),
      collectionWindowBundle('http://localhost').documents.compositions[0],
    )
    Endge.domain.addComposition(Object.assign(new RComposition(), document))
    const payload = Endge.source.compile('composition', document.source)
      .artifact as CompositionProgramPayload
    const artifacts = {
      getArtifact: () => ({ payload, status: 'valid' }),
    } as unknown as RuntimeArtifactReader
    const root = buildRuntimePreviewTree(
      { entityType: 'composition', identity: document.identity },
      artifacts,
    )[0]!
    const node = root.children.find(
      node => node.runtimeKind === 'controller',
    )!
    expect(node).toMatchObject({
      entityType: 'controller',
      runtimeKind: 'controller',
      runtimePath: 'window',
      activationMode: 'startup',
      presentation: { documentType: null, icon: 'Cpu' },
    })
    expect(node.subtitle).toContain('runtime-only')
  })
})

it('completes a dotted Controller identity from the opening quote and disposes assistance', () => {
  let completion: any
  let hover: any
  const dispose = vi.fn()
  const text = 'window: controller(\'endge.coll'
  const model = {
    getLanguageId: () => 'endge-composition-source',
    getLineContent: () => text,
  }
  const monaco = {
    languages: {
      CompletionItemKind: { Value: 1 },
      registerCompletionItemProvider: (_language: string, provider: any) => {
        completion = provider
        return { dispose }
      },
      registerHoverProvider: (_language: string, provider: any) => {
        hover = provider
        return { dispose }
      },
    },
    Range: class {
      constructor(
        public startLineNumber: number,
        public startColumn: number,
        public endLineNumber: number,
        public endColumn: number,
      ) {}
    },
  }
  const resource = createControllerSourceContribution().install({
    monaco,
    model,
  } as any)!
  const result = completion.provideCompletionItems(model, {
    lineNumber: 1,
    column: text.length + 1,
  })
  expect(
    result.suggestions.find(
      (item: any) => item.label === 'endge.collection-window',
    ),
  ).toMatchObject({
    insertText: 'endge.collection-window',
    range: { startColumn: text.indexOf('\'') + 2, endColumn: text.length + 1 },
  })
  expect(
    hover.provideHover(model, { lineNumber: 1, column: text.length + 1 }),
  ).toBe(null)
  resource.dispose()
  expect(dispose).toHaveBeenCalledTimes(2)
})

it('inspects a compiled program-only Controller without a registry definition or provider', () => {
  const definition: ControllerDefinition = {
    identity: 'test.program-only',
    displayName: 'Program-only Controller',
    origin: { kind: 'local', owner: 'test' },
    defaultProviderKey: 'test.not-installed',
    catalogPath: ['Program'],
    contract: {
      props: [],
      outputs: [],
      commands: { inspect: {} },
      dependencies: {},
    },
  }
  const remove = Endge.runtime.controllers.define(definition)
  let artifact
  try {
    artifact = Endge.compiler.buildController(definition.identity)
  }
  finally {
    remove()
  }
  Endge.program.addArtifact(artifact)
  const hosts = Endge.runtime.snapshot().hosts.length
  try {
    expect(Endge.runtime.controllers.get(definition.identity)).toBe(null)
    expect(getControllerCatalogDefinitions()).toContainEqual(definition)
    expect(resolveControllerCatalogDefinition(definition.identity)).toEqual(
      definition,
    )
    expect(Endge.runtime.snapshot().hosts).toHaveLength(hosts)
  }
  finally {
    Endge.program.clear()
  }
})

it('prefers the compiled bundle contract in debugger and preserves runtime precedence elsewhere', () => {
  const runtime = Endge.runtime.controllers.get('endge.collection-window')!
  const program = {
    ...runtime,
    displayName: 'Bundle contract',
    defaultProviderKey: 'bundle.required-provider',
    contract: { ...runtime.contract, props: [] },
  }
  expect(mergeControllerDefinitions([runtime], [program], true)).toEqual([
    program,
  ])
  expect(mergeControllerDefinitions([runtime], [program], false)).toEqual([
    runtime,
  ])
})
