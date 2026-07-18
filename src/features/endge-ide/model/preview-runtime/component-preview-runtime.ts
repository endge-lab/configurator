import type {
  ComponentSFCPreviewOptions,
  ComponentSFCPreviewProps,
  CompositionRuntimeHost,
  RuntimeAppScope,
  RuntimeHostInputSource,
} from '@endge/core'

import { Endge, RComposition } from '@endge/core'
import { Raph } from '@endge/raph'

export interface ComponentPreviewSource {
  id?: string | number | null
  identity?: string | null
  name?: string | null
  displayName?: string | null
}

export interface ComponentPreviewContext {
  host: CompositionRuntimeHost
  dataAliases: Map<string, string>
}

interface ComponentPreviewContextOptions {
  appScope?: RuntimeAppScope
  contextSuffix?: string
  meta?: Record<string, unknown>
  resolveStoreRuntime?: (identity: string) => { id: string, entityType: string } | null
}

/** Materializes definePreviewProps options into a runtime context shared by preview surfaces. */
export async function prepareComponentPreviewContext(
  options: ComponentSFCPreviewOptions | null,
  props: ComponentSFCPreviewProps,
  source: ComponentPreviewSource,
  runtimeOptions: ComponentPreviewContextOptions = {},
): Promise<ComponentPreviewContext | null> {
  for (const [path, value] of Object.entries(options?.seed ?? {})) {
    Raph.set(path, clonePreviewValue(value))
  }

  await ensurePreviewQueryArtifacts(options)

  const storeIdentities = new Set<string>()
  for (const value of Object.values(props)) {
    if (isDataPreviewProp(value)) {
      storeIdentities.add(value.store)
    }
  }
  for (const target of options?.run ?? []) {
    if (target.storeTo) {
      storeIdentities.add(target.storeTo.store)
    }
  }
  const targets = options?.run ?? []
  if (!storeIdentities.size && !targets.length) {
    return null
  }

  const dataAliases = new Map<string, string>()
  Array.from(storeIdentities).forEach((identity, index) => dataAliases.set(identity, `store${index}`))
  const model = createPreviewComposition(
    source,
    dataAliases,
    targets,
    runtimeOptions.contextSuffix ?? 'sfc-context',
  )
  const artifact = Endge.compiler.buildComposition(model)
  if (artifact.status === 'error') {
    const message = artifact.diagnostics.find(item => item.severity === 'error')?.message
      ?? 'Не удалось собрать preview composition.'
    throw new Error(message)
  }

  const host = Endge.runtime.execute(model, {
    appScope: runtimeOptions.appScope,
    meta: {
      ...(runtimeOptions.meta ?? {}),
      dataRuntimes: resolvePreviewStoreRuntimes(dataAliases, runtimeOptions.resolveStoreRuntime),
    },
  }) as CompositionRuntimeHost | null
  if (!host || host.entityType !== 'composition') {
    throw new Error('Не удалось создать preview composition runtime.')
  }
  try {
    await host.mountGraph()
  }
  catch (error) {
    Endge.runtime.destroyRuntimeTree(host.id)
    throw error
  }
  return { host, dataAliases }
}

/** Resolves literal, fromStore and fromData declarations into the renderer input contract. */
export function resolveComponentPreviewInput(
  previewProps: ComponentSFCPreviewProps,
  context: ComponentPreviewContext | null,
  localPropsPath = 'preview.sfc.props',
): RuntimeHostInputSource {
  const bindings: Record<string, { path: string, wildcardDynamic: true }> = {}
  const localProps: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(previewProps)) {
    if (isStorePreviewProp(value)) {
      bindings[key] = {
        path: value.path,
        wildcardDynamic: true,
      }
      continue
    }
    if (isDataPreviewProp(value)) {
      const alias = context?.dataAliases.get(value.store)
      if (!alias || !context) {
        throw new Error(`Preview Store not mounted: "${value.store}".`)
      }
      bindings[key] = {
        path: context.host.getDataPath(alias, value.path),
        wildcardDynamic: true,
      }
      continue
    }

    localProps[key] = clonePreviewValue(value)
  }

  if (Object.keys(bindings).length === 0) {
    return { kind: 'local', props: localProps }
  }

  for (const [key, value] of Object.entries(localProps)) {
    const path = `${localPropsPath}.${key}`
    Raph.set(path, value)
    bindings[key] = {
      path,
      wildcardDynamic: true,
    }
  }

  return {
    kind: 'raph',
    bindings,
  }
}

export async function destroyComponentPreviewContext(context: ComponentPreviewContext | null): Promise<void> {
  if (context && Endge.runtime.getRuntimeById(context.host.id)) {
    await Endge.runtime.destroyRuntimeTreeAsync(context.host.id)
  }
}

function resolvePreviewStoreRuntimes(
  dataAliases: Map<string, string>,
  resolveStoreRuntime?: ComponentPreviewContextOptions['resolveStoreRuntime'],
): Record<string, string> {
  if (!resolveStoreRuntime) {
    return {}
  }
  const runtimes: Record<string, string> = {}
  for (const [identity, alias] of dataAliases) {
    const runtime = resolveStoreRuntime(identity)
    if (runtime?.entityType === 'store') {
      runtimes[alias] = runtime.id
    }
  }
  return runtimes
}

async function ensurePreviewQueryArtifacts(options: ComponentSFCPreviewOptions | null): Promise<void> {
  const queryTargets = options?.run?.filter(target => target.type === 'query') ?? []
  if (!queryTargets.length) {
    return
  }

  try {
    await Endge.build()
  }
  catch {
    // Preview still tries to compile the requested queries directly below.
  }

  for (const target of queryTargets) {
    const query = Endge.domain.getQuery(target.identity)
    if (!query) {
      throw new Error(`Preview query not found: "${target.identity}".`)
    }

    const idOrIdentity = query.id ?? query.identity
    if (Endge.program.getQueryArtifact(idOrIdentity)) {
      continue
    }

    Endge.compiler.buildQuery(query)
  }
}

function createPreviewComposition(
  input: ComponentPreviewSource,
  dataAliases: Map<string, string>,
  targets: NonNullable<ComponentSFCPreviewOptions['run']>,
  contextSuffix: string,
): RComposition {
  const data = Array.from(dataAliases.entries())
    .map(([identity, alias]) => `${alias}: store(${JSON.stringify(identity)})`)
    .join(',\n    ')
  const runtimes = targets.map((target, index) => {
    const publication = target.storeTo
      ? `.storeTo(data(${JSON.stringify(dataAliases.get(target.storeTo.store))}), ${serializeStoreMapping(target.storeTo.fields)})`
      : ''
    return `query${index}: query(${JSON.stringify(target.identity)})${publication}`
  }).join(',\n    ')
  const hooks = targets.map((_, index) => `onMount().run('query${index}')`).join(',\n    ')
  const identity = `${resolvePreviewIdentity(input)}-${contextSuffix}`
  const model = new RComposition()
  model.id = `${identity}-model` as any
  model.identity = identity
  model.name = 'SFC preview composition'
  model.displayName = 'SFC preview composition'
  model.source = `defineComposition({
  data: {
    ${data}
  },
  runtimes: {
    ${runtimes}
  },
  hooks: [
    ${hooks}
  ],
})`
  return model
}

function resolvePreviewIdentity(input: ComponentPreviewSource): string {
  const source = input.identity ?? input.id ?? input.name ?? input.displayName ?? 'draft'
  return String(source).trim() || 'draft'
}

function serializeStoreMapping(fields: Record<string, string>): string {
  return `{ ${Object.entries(fields)
    .map(([target, output]) => `${JSON.stringify(target)}: output(${JSON.stringify(output)})`)
    .join(', ')} }`
}

function isStorePreviewProp(value: unknown): value is { type: 'store', path: string } {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value as { type?: unknown }).type === 'store'
    && typeof (value as { path?: unknown }).path === 'string',
  )
}

function isDataPreviewProp(value: unknown): value is { type: 'data', store: string, path: string } {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value as { type?: unknown }).type === 'data'
    && typeof (value as { store?: unknown }).store === 'string'
    && typeof (value as { path?: unknown }).path === 'string',
  )
}

function clonePreviewValue(value: unknown): unknown {
  if (value == null) {
    return value
  }

  try {
    return JSON.parse(JSON.stringify(value))
  }
  catch {
    return value
  }
}
