import type { DiagnosticsEntityRef, DiagnosticsProblemInput } from '@endge/core'
import type { Ref } from 'vue'
import type { ServiceBackendIntegrationCatalogHttpAdapter } from '@/features/endge-ide/adapters/backend/ServiceBackendIntegrationCatalogHttp_Adapter'
import type { ServiceBackendModulesHttpAdapter } from '@/features/endge-ide/adapters/backend/ServiceBackendModulesHttp_Adapter'
import type { EndgeIDEGraphQLSchema_Module } from '@/features/endge-ide/modules/graphql-schema/EndgeIDEGraphQLSchema_Module'
import type { EndgeIDEIntegrations_Module } from '@/features/endge-ide/modules/integrations/EndgeIDEIntegrations_Module'
import type { EndgeIDETabs_Module } from '@/features/endge-ide/modules/tabs/EndgeIDETabs_Module'
import { createDiagnosticsEntityOwner, Endge } from '@endge/core'
import { computed, ref } from 'vue'

import { getLayoutState, showWidget } from '@/components/layouts/grid/layout'
import { ENDGE_IDE_DOMAIN_WIDGET_ID } from '@/features/endge-ide/domain/types/domain-workspace.types'
import { ENDGE_IDE_PROBLEMS_WIDGET_ID } from '@/features/endge-ide/domain/types/problems-workspace.types'
import { buildProblemsEntityEntries, buildProblemsSeverityGroups } from '@/features/endge-ide/services/diagnostics/problems-workspace-presentation'
import { checkWorkspaceModules } from '@/features/endge-ide/services/diagnostics/workspace-dependency-checks'
import { checkWorkspaceIntegrations } from '@/features/endge-ide/services/diagnostics/workspace-integration-checks'
import { collectGraphQLSchemaProblems } from '@/features/endge-ide/services/graphql-schema/graphql-schema-problems'

const analysisPrefix = 'workspace-analysis:'
const analysisOwner = { key: `${analysisPrefix}build`, phase: 'build' } as const

interface DraftDiagnostic {
  severity?: DiagnosticsProblemInput['severity']
  message?: string
  code?: string
  sourcePath?: string
  start?: number
  end?: number
}

type AnalysisStatus = 'idle' | 'running' | 'complete' | 'incomplete' | 'stale'

/**
 * Presentation controller самостоятельной рабочей области Problems.
 */
export class EndgeIDEProblems_Module {
  private readonly _revision = ref(0)
  private readonly _selectedEntityKey = ref<string | null>(null)
  private readonly _analysisStatus = ref<AnalysisStatus>('idle')
  private _request: AbortController | null = null
  private _unsubscribeDomain: (() => void) | null = null
  private _unsubscribe: (() => void) | null = null

  public readonly analysisStatus: Readonly<Ref<AnalysisStatus>> = this._analysisStatus

  public constructor(
    private readonly _graphqlSchema: EndgeIDEGraphQLSchema_Module,
    private readonly _modules: ServiceBackendModulesHttpAdapter,
    private readonly _tabs: EndgeIDETabs_Module,
    private readonly _integrations: EndgeIDEIntegrations_Module,
    private readonly _integrationCatalog: ServiceBackendIntegrationCatalogHttpAdapter,
  ) {}

  public readonly selectedEntityKey: Readonly<Ref<string | null>> = this._selectedEntityKey
  public readonly entries = computed(() => {
    void this._revision.value
    return buildProblemsEntityEntries(Endge.diagnostics.problems.query())
  })

  public readonly groups = computed(() => buildProblemsSeverityGroups(this.entries.value))
  public readonly selectedEntry = computed(() => {
    return this.entries.value.find(entry => entry.key === this.selectedEntityKey.value) ?? null
  })

  /**
   * Подписывает presentation controller на core registry без копирования problems.
   */
  public init(): void {
    if (this._unsubscribe) {
      return
    }
    this._unsubscribe = Endge.diagnostics.problems.subscribe(() => {
      this._revision.value += 1
      this._synchronizeSelection()
    })
    this._unsubscribeDomain = Endge.domain.subscribe(() => {
      if (this._analysisStatus.value === 'complete' || this._analysisStatus.value === 'incomplete') {
        this._analysisStatus.value = 'stale'
      }
    })
    this._synchronizeSelection()
  }

  public async analyze(): Promise<void> {
    if (this._request) {
      return
    }
    const request = new AbortController()
    this._request = request
    this._analysisStatus.value = 'running'
    this._clearAnalysisProblems()

    try {
      await Endge.build()
      request.signal.throwIfAborted()
      const context = Endge.configuration.buildContext
      let domainChanged = false
      const unsubscribe = Endge.domain.subscribe(() => {
        domainChanged = true
      })
      const findings = new Map<string, { entityRef: DiagnosticsEntityRef, problems: DiagnosticsProblemInput[] }>()
      function append(entityRef: DiagnosticsEntityRef, problems: DiagnosticsProblemInput[]): void {
        if (problems.length) {
          const key = createDiagnosticsEntityOwner(entityRef, 'build').key
          const entry = findings.get(key) ?? { entityRef, problems: [] }
          entry.problems.push(...problems)
          findings.set(key, entry)
        }
      }

      try {
        const sourceContext = Endge.source.currentSourceContext() ?? undefined
        const compiler = {
          compile: (kind: string, source: string) => Endge.source.compile(kind, source, {
            sourceContext,
            executionContext: context.execution.facets,
          }),
        }
        for (const query of Endge.domain.getQueries()) {
          if (query.active !== false && !query.deletedAt) {
            append({ entityType: 'query', id: query.id, identity: query.identity }, collectGraphQLSchemaProblems(this._graphqlSchema, compiler, 'query', query.source, true))
          }
        }
        for (const stream of Endge.domain.getStreams()) {
          if (stream.active !== false && !stream.deletedAt) {
            append({ entityType: 'stream', id: stream.id, identity: stream.identity }, collectGraphQLSchemaProblems(this._graphqlSchema, compiler, 'stream', stream.source, true))
          }
        }
        const [modules, integrations] = await Promise.all([
          checkWorkspaceModules(this._modules, request.signal),
          checkWorkspaceIntegrations(this._integrationCatalog, this._integrations, request.signal),
        ])
        for (const { entityRef, problem } of [...modules, ...integrations]) {
          append(entityRef, [problem])
        }
      }
      finally {
        unsubscribe()
      }
      request.signal.throwIfAborted()
      if (domainChanged || context !== Endge.configuration.buildContext) {
        this._analysisStatus.value = 'stale'
        return
      }
      const dirtyCount = this._tabs.openTabs.value.filter(tab => this._tabs.isTabDirty(tab.id)).length
      if (dirtyCount) {
        Endge.diagnostics.problems.replace(analysisOwner, [{
          code: 'workspace-drafts-not-checked',
          severity: 'warning',
          message: `Связи проверены по загруженным документам. Несохранённые изменения во вкладках проверяются отдельно по Source (${dirtyCount}).`,
        }])
      }
      for (const draft of this._tabs.getDirtySourceDocuments()) {
        if (!Endge.source.resolveLanguageStrategy(draft.sourceKind)) {
          continue
        }
        const result = Endge.source.validate(draft.sourceKind, draft.source, {
          sourceContext: Endge.source.currentSourceContext() ?? undefined,
        })
        const problems = (result.diagnostics as DraftDiagnostic[]).flatMap((diagnostic) => {
          if (!diagnostic.message || !diagnostic.severity || diagnostic.severity === 'info') {
            return []
          }
          return [{ ...diagnostic, code: diagnostic.code ?? 'draft-source-invalid', message: `Черновик · ${diagnostic.message}`, severity: diagnostic.severity }]
        })
        if (problems.length) {
          const owner = createDiagnosticsEntityOwner(draft.ref, 'authoring')
          Endge.diagnostics.problems.replace({ ...owner, key: analysisPrefix + owner.key }, problems)
        }
      }
      for (const [key, { entityRef, problems }] of findings) {
        Endge.diagnostics.problems.replace({ key: analysisPrefix + key, phase: 'build', entityRef }, problems)
      }
      this._analysisStatus.value = Endge.diagnostics.problems.query({ phases: ['build'] }).some(problem =>
        problem.code === 'domain-build-incomplete' || problem.code.endsWith('-not-checked'))
        ? 'incomplete'
        : 'complete'
    }
    catch {
      if (!request.signal.aborted) {
        Endge.diagnostics.problems.replace(analysisOwner, [{
          code: 'workspace-analysis-incomplete',
          severity: 'error',
          message: 'Проверка домена прервалась. Запустите её повторно.',
        }])
        this._analysisStatus.value = 'incomplete'
      }
    }
    finally {
      if (this._request === request) {
        this._request = null
      }
    }
  }

  private _clearAnalysisProblems(): void {
    const keys = new Set(Endge.diagnostics.problems.query().map(problem => problem.owner.key).filter(key => key.startsWith(analysisPrefix)))
    if (keys.size) {
      Endge.diagnostics.problems.clear({ ownerKeys: [...keys] })
    }
  }

  /**
   * Отписывает controller и очищает только configurator selection.
   */
  public reset(): void {
    this._request?.abort()
    this._request = null
    this._unsubscribeDomain?.()
    this._unsubscribeDomain = null
    this._analysisStatus.value = 'idle'
    this._clearAnalysisProblems()
    this._unsubscribe?.()
    this._unsubscribe = null
    this._selectedEntityKey.value = null
    this._revision.value = 0
  }

  /**
   * Выбирает проблемную сущность для отображения в основной части workspace.
   */
  public selectEntity(entityKey: string): void {
    if (this.entries.value.some(entry => entry.key === entityKey)) {
      this._selectedEntityKey.value = entityKey
    }
  }

  /**
   * Возвращает пользователя из Problems workspace к Domain widget.
   */
  public returnToDomain(): boolean {
    const area = getLayoutState().widgets.value.areas.left
    if (!area.expanded || area.activeWidget !== ENDGE_IDE_PROBLEMS_WIDGET_ID) {
      return false
    }
    showWidget(ENDGE_IDE_DOMAIN_WIDGET_ID)
    return true
  }

  /**
   * Сохраняет selection, пока сущность существует, иначе выбирает первую проблемную сущность.
   */
  private _synchronizeSelection(): void {
    const selectedExists = this.entries.value.some(entry => entry.key === this.selectedEntityKey.value)
    if (!selectedExists) {
      this._selectedEntityKey.value = this.entries.value[0]?.key ?? null
    }
  }
}
