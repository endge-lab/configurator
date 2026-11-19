import type { CompositionProgramPayload, DiagnosticsEntityRef, DiagnosticsProblemInput, EndgeConfiguration, ModuleReference } from '@endge/core'
import type { ServiceBackendModulesHttpAdapter } from '@/features/endge-ide/adapters/backend/ServiceBackendModulesHttp_Adapter'

import { Endge, isModuleReference, parseModuleRendererSelection } from '@endge/core'

interface ModuleUse {
  entityRef: DiagnosticsEntityRef
  reference: ModuleReference
  sourcePath: string
  renderer?: { tag: string, id: string }
}

export async function checkWorkspaceModules(
  transport: ServiceBackendModulesHttpAdapter,
  signal: AbortSignal,
): Promise<Array<{ entityRef: DiagnosticsEntityRef, problem: DiagnosticsProblemInput }>> {
  const uses = collectModuleUses()
  const versions = new Map<string, ReturnType<ServiceBackendModulesHttpAdapter['describeVersion']>>()
  const results: Array<{ entityRef: DiagnosticsEntityRef, problem: DiagnosticsProblemInput }> = []
  // Небольшие партии ограничивают число одновременных запросов к каталогу.
  for (let offset = 0; offset < uses.length; offset += 8) {
    signal.throwIfAborted()
    const problems = await Promise.all(uses.slice(offset, offset + 8).map(async (use) => {
      const { reference, entityRef, sourcePath, renderer } = use
      const label = `${reference.identity}@${reference.version}`
      function problem(code: string, message: string, severity: 'error' | 'warning' = 'error') {
        return { entityRef, problem: { code, message, severity, sourcePath } }
      }
      if (!isModuleReference(reference.identity, reference.version)) {
        return [problem('module-reference-invalid', 'Укажите identity модуля и точную версию SemVer.')]
      }
      try {
        let request = versions.get(label)
        if (!request) {
          request = transport.describeVersion(reference, signal)
          versions.set(label, request)
        }
        const version = await request
        if (!version) {
          return [problem('module-version-missing', `Закреплённая версия модуля "${label}" не найдена.`)]
        }
        if (!transport.isCompatibleManifest(version.manifest, reference)) {
          return [problem('module-version-incompatible', `Manifest модуля "${label}" несовместим с текущим host.`)]
        }
        const findings = []
        if (version.moduleArchived) {
          findings.push(problem('module-archived', `Модуль "${reference.identity}" в архиве. Закреплённая версия "${reference.version}" доступна.`, 'warning'))
        }
        else if (version.moduleArchived === undefined) {
          findings.push(problem('module-archive-status-not-checked', `Backend не сообщает архивный статус модуля "${reference.identity}".`, 'warning'))
        }
        if (renderer && !version.manifest.contributes?.renderers?.some(item => item.id === renderer.id && item.primitive === renderer.tag)) {
          findings.push(problem('module-renderer-missing', `Модуль "${label}" не объявляет renderer "${renderer.id}" для "${renderer.tag}".`))
        }
        return findings
      }
      catch {
        signal.throwIfAborted()
        return [problem('module-version-not-checked', `Версия "${label}" не проверена. Метаданные каталога недоступны.`, 'warning')]
      }
    }))
    results.push(...problems.flat())
  }
  return results
}

function collectModuleUses(): ModuleUse[] {
  const uses: ModuleUse[] = []
  for (const composition of Endge.domain.getCompositions()) {
    const artifact = Endge.program.getCompositionArtifact(composition.identity)
    if (!artifact) {
      continue
    }
    const payload: CompositionProgramPayload = artifact.payload
    const declared = composition.source.includes('enabledWhen')
      ? Endge.source.compile('composition', composition.source, { sourceVersion: composition.sourceVersion }).artifact as CompositionProgramPayload | undefined
      : undefined
    const activePaths = new Set(payload.resources.map(resource => resource.path))
    const resources = [...payload.resources, ...(declared?.resources.filter(resource => !activePaths.has(resource.path)) ?? [])]
    const parents = new Map(payload.scopes.map(scope => [scope.path, scope.parentPath]))
    for (const runtime of payload.runtimes) {
      for (const [tag, selection] of Object.entries(runtime.renderers ?? {})) {
        const renderer = parseModuleRendererSelection(selection)
        if (!renderer) {
          continue
        }
        for (let scope: string | null = runtime.scopePath; scope; scope = parents.get(scope) ?? null) {
          const resource = payload.resources.find(item => item.kind === 'module' && item.name === renderer.attachment && item.scopePath === scope)
          if (resource?.kind === 'module') {
            uses.push({
              entityRef: artifact.ref,
              reference: resource,
              sourcePath: `runtimes.${runtime.path}.renderers.${tag}`,
              renderer: { tag, id: renderer.rendererId },
            })
            break
          }
        }
      }
    }
    for (const resource of resources) {
      if (resource.kind !== 'module') {
        continue
      }
      const entityRef = artifact.ref
      const sourcePath = `resources.${resource.path}`
      if (!resource.contextSwitch) {
        uses.push({ entityRef, reference: resource, sourcePath })
        continue
      }
      if (resource.contextSwitch.default) {
        uses.push({ entityRef, reference: resource.contextSwitch.default, sourcePath: `${sourcePath}.default` })
      }
      for (const [index, branch] of resource.contextSwitch.cases.entries()) {
        if (branch.reference) {
          uses.push({ entityRef, reference: branch.reference, sourcePath: `${sourcePath}.cases.${index}.use` })
        }
      }
    }
  }
  if (Endge.workspace.isLoaded) {
    const workspace = Endge.workspace.current
    const identity = workspace.identity
    const workspaceRef = { entityType: 'workspace', id: identity, identity }
    addRenderers(workspaceRef, workspace.configuration.defaultRenderers)
    for (const facet of Endge.domain.getFacets().filter(item => item.active !== false && !item.deletedAt)) {
      for (const document of Endge.domain.getFacetDocuments(facet.identity)) {
        if (document.deletedAt || document.active === false) {
          continue
        }
        const contribution = document.configuration
        const renderers = contribution.mode === 'replace'
          ? contribution.value.defaultRenderers
          : Object.fromEntries(Object.entries(contribution.patch.defaultRenderers ?? {})
              .flatMap(([tag, override]) => override.op === 'set' ? [[tag, override.value]] : []))
        addRenderers({ entityType: 'facet-document', id: document.id, identity: document.identity }, renderers)
      }
    }
  }
  return uses

  function addRenderers(entityRef: DiagnosticsEntityRef, renderers: EndgeConfiguration['defaultRenderers']): void {
    for (const [tag, renderer] of Object.entries(renderers ?? {})) {
      uses.push({
        entityRef,
        reference: renderer,
        sourcePath: `configuration.defaultRenderers.${tag}`,
        renderer: { tag, id: renderer.rendererId },
      })
    }
  }
}
