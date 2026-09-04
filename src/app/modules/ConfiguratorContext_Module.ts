import type {
  EndgeBootContext,
  EndgeDomainProvider,
  EndgeExecutionContext,
} from '@endge/core'
import type {
  ConfiguratorContextInitOptions,
  ConfiguratorContextSurfaceLifecycle,
} from '@/app/domain/types/configurator-context.type'
import type { EndgeBackendConfig } from '@/features/endge-ide/domain/types/endge-backend.type'

import {
  Endge,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
} from '@endge/core'

import { registerEndgeMockProviders } from '@/features/endge-ide/bootstrap/endge-mock-providers'
import { getEndgeBackendConfig } from '@/features/endge-ide/config/endge-backend'
import { configuratorDataModeRepository } from '@/features/endge-ide/services/context/configurator-data-mode-repository'

const CONFIGURATOR_SFC_ADAPTER_FALLBACK_IDS = ['vue-shadcn', 'vue-native'] as const

/**
 * Управляет boot и immutable execution context всей IDE.
 */
export class ConfiguratorContext_Module {
  private _isInitialized = false
  private _isSwitchingContext = false
  private _switchQueue: Promise<void> = Promise.resolve()
  private _currentContext: Partial<EndgeExecutionContext> = {}
  private _requestedContext: Partial<EndgeExecutionContext> = {}
  private _backendConfig: EndgeBackendConfig | null = null
  private _domainProvider: EndgeDomainProvider | null = null
  private _workspaceRole: 'viewer' | 'editor' | 'admin' | null = null
  private _workspaceIdentity: string | null = null
  private readonly _listeners = new Set<() => void>()
  private readonly _surfaces = new Map<string, ConfiguratorContextSurfaceLifecycle>()

  /**
   * Одноразово запускает прикладное ядро конфигуратора.
   * Передает boot-контекст в `Endge.boot()` и проверяет выбранный renderer adapter.
   */
  public async init(options: ConfiguratorContextInitOptions = {}): Promise<void> {
    if (this._isInitialized) {
      return
    }

    const backendConfig = this._backendConfig ?? options.backendConfig ?? getEndgeBackendConfig()
    const domainProvider = this._domainProvider ?? options.domainProvider ?? null
    if (!domainProvider) {
      throw new Error('[EndgeIDE] domainProvider is required')
    }

    this._backendConfig = backendConfig
    this._domainProvider = domainProvider
    this._workspaceRole = this._workspaceRole ?? options.workspaceRole ?? null
    this._workspaceIdentity = this._workspaceIdentity ?? options.workspaceIdentity ?? null
    const ctx = this._createBootContext(options.context, backendConfig, domainProvider)

    registerEndgeMockProviders()
    let bootCompleted = false
    try {
      await Endge.boot(ctx)
      bootCompleted = true
      this._restoreDataModeOverride()
      this._assertWorkspaceRendererReady()
    }
    catch (cause) {
      this._isInitialized = false
      this._currentContext = {}
      this._requestedContext = {}
      this._notify()

      if (bootCompleted) {
        try {
          await Endge.reset()
        }
        catch (resetCause) {
          throw new AggregateError(
            [cause, resetCause],
            '[EndgeIDE] initialization failed and Core cleanup was incomplete',
          )
        }
      }
      throw cause
    }

    this._isInitialized = true
    this._currentContext = { ...Endge.context.getExecutionContext() }
    this._requestedContext = { ...this._currentContext }
    this._notify()
  }

  /** Полностью перезапускает Endge под новым immutable structural context. */
  public async switchContext(next: Partial<EndgeExecutionContext>): Promise<void> {
    const requested = { ...this._requestedContext, ...next }
    if (
      next.projectIdentity != null
      && next.projectIdentity !== this._requestedContext.projectIdentity
      && !Object.hasOwn(next, 'environmentIdentity')
    ) {
      requested.environmentIdentity = undefined
    }
    this._requestedContext = requested
    this._switchQueue = this._switchQueue
      .catch(() => undefined)
      .then(() => this._performContextSwitch(requested))
    return this._switchQueue
  }

  /**
   * Принудительно очищает все модули Endge и повторяет полный boot текущего
   * контекста: setup -> load from provider -> build -> start.
   */
  public async reloadCurrentContext(): Promise<void> {
    const requested = { ...this._requestedContext }
    this._switchQueue = this._switchQueue
      .catch(() => undefined)
      .then(() => this._performContextSwitch(requested, true))
    return this._switchQueue
  }

  /**
   * Сбрасывает состояние Endge и локальный флаг запуска приложения.
   * Используется для полного повторного boot без пересоздания IDE context runtime.
   */
  public async reset(): Promise<void> {
    this._isInitialized = false
    this._notify()
    await Endge.reset()
  }

  /** Собирает boot-контекст из единожды выбранного backend provider. */
  private _createBootContext(
    context: Partial<EndgeExecutionContext> = {},
    backendConfig: EndgeBackendConfig,
    domainProvider: EndgeDomainProvider | null,
  ): EndgeBootContext {
    const workspaceIdentity = this._workspaceIdentity ?? String(import.meta.env.VITE_ENDGE_WORKSPACE_IDENTITY || '').trim()
    const tenantIdentity = String(import.meta.env.VITE_ENDGE_TENANT_IDENTITY || '').trim()
    const projectIdentity = String(import.meta.env.VITE_ENDGE_PROJECT_IDENTITY || '').trim()
    const environmentIdentity = String(import.meta.env.VITE_ENDGE_ENVIRONMENT_IDENTITY || '').trim()
    const authVariables = readAuthVariableRecord(import.meta.env)
    const commonContext = {
      scope: workspaceIdentity ? { workspaceIdentity } : {},
      context: {
        ...(tenantIdentity ? { tenantIdentity } : {}),
        ...(projectIdentity ? { projectIdentity } : {}),
        ...(environmentIdentity ? { environmentIdentity } : {}),
        ...context,
      },
      vars: {
        OIDC_ISSUER: import.meta.env.VITE_OIDC_ISSUER,
        ENDPOINT_AUTH: import.meta.env.VITE_ENDPOINT_AUTH,
        ...authVariables,
        // Application env передаётся в ядро явно: @endge/core собирается отдельно
        // и не должен читать import.meta.env приложения из своего library bundle.
        SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
        SENTRY_ENVIRONMENT: import.meta.env.VITE_SENTRY_ENVIRONMENT,
        SENTRY_RELEASE: import.meta.env.VITE_SENTRY_RELEASE,
      },
      ui: {
        adapterFallbackIds: CONFIGURATOR_SFC_ADAPTER_FALLBACK_IDS,
      },
      auth: {
        storageNamespace: backendConfig.activeBackendURL,
      },
    }

    if (!domainProvider) {
      throw new Error('[EndgeIDE] domainProvider is required')
    }

    return {
      ...commonContext,
      dataProvider: 'default',
      domainProvider,
    }
  }

  private async _performContextSwitch(
    next: Partial<EndgeExecutionContext>,
    forceReload = false,
  ): Promise<void> {
    const previous = { ...this._currentContext }
    if (!forceReload && sameContext(previous, next)) {
      return
    }

    this._isSwitchingContext = true
    this._notify()
    try {
      await this._runSurfaceHook('beforeContextReset')
      await this.reset()
      await this.init({ context: next })
      await this._runSurfaceHook('afterContextBoot')
    }
    catch (error) {
      try {
        await this.reset()
        await this.init({ context: previous })
        await this._runSurfaceHook('afterContextBoot')
      }
      catch {
        // Исходная ошибка содержит первичную причину; rollback best-effort.
      }
      throw error
    }
    finally {
      this._isSwitchingContext = false
      this._notify()
    }
  }

  /** Подписывает UI на boot/context-switch состояние IDE context runtime. */
  public subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  /** Регистрирует смонтированную поверхность приложения, владеющую runtime handles между перезапусками контекста. */
  public registerSurface(id: string, lifecycle: ConfiguratorContextSurfaceLifecycle): () => void {
    const key = String(id ?? '').trim()
    if (!key) {
      throw new Error('[EndgeIDE] surface id is required.')
    }
    this._surfaces.set(key, lifecycle)
    return () => {
      if (this._surfaces.get(key) === lifecycle) {
        this._surfaces.delete(key)
      }
    }
  }

  private async _runSurfaceHook(hook: keyof ConfiguratorContextSurfaceLifecycle): Promise<void> {
    for (const lifecycle of this._surfaces.values()) {
      await lifecycle[hook]?.()
    }
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      listener()
    }
  }

  /** Восстанавливает переопределение Configurator после загрузки Workspace через Endge.boot(). */
  private _restoreDataModeOverride(): void {
    const workspaceIdentity = Endge.workspace.current.identity
    const mode = configuratorDataModeRepository.read(this._activeBackendURL(), workspaceIdentity)
    if (mode) {
      Endge.context.setDataMode(mode)
    }
    else {
      Endge.context.clearDataModeOverride()
    }
  }

  private _assertWorkspaceRendererReady(): void {
    const adapter = Endge.uiRegistry.adapters.requireActive({
      protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
      protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
      requiredRendererKeys: ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
      requiredRootKeys: ['shell', 'sfc', 'sfc-runtime', 'filter-view'],
    })
    const expectedAdapter = Endge.uiRegistry.adapters.resolveAvailable(
      Endge.workspace.defaultSfcAdapterId,
      CONFIGURATOR_SFC_ADAPTER_FALLBACK_IDS,
    )

    if (!expectedAdapter) {
      Endge.uiRegistry.adapters.require({ id: Endge.workspace.defaultSfcAdapterId })
      return
    }

    if (adapter.id !== expectedAdapter.id) {
      throw new Error(
        `[EndgeIDE] active SFC adapter "${adapter.id}" does not match resolved adapter "${expectedAdapter.id}"`,
      )
    }
  }

  /**
   * Показывает, был ли уже выполнен успешный boot текущего приложения.
   */
  public get isInitialized(): boolean {
    return this._isInitialized
  }

  public get isSwitchingContext(): boolean {
    return this._isSwitchingContext
  }

  public get currentContext(): Readonly<Partial<EndgeExecutionContext>> {
    return this._currentContext
  }

  /** Возвращает единожды выбранную конфигурацию backend без повторного чтения env. */
  public get backendConfig(): Readonly<EndgeBackendConfig> | null {
    return this._backendConfig
  }

  /** Эффективная роль текущего разработчика в выбранном workspace. */
  public get workspaceRole(): 'viewer' | 'editor' | 'admin' | null {
    return this._workspaceRole
  }

  /** Workspace, выбранный при авторизованном запуске Configurator. */
  public get workspaceIdentity(): string {
    return this._workspaceIdentity ?? Endge.workspace.current.identity
  }

  /** Возвращает фактический режим данных для fixtures Store и выполнения Query. */
  public get isMockEnabled(): boolean {
    return Endge.context.isMockEnabled
  }

  /** Показывает, переопределяет ли Configurator текущее значение Workspace по умолчанию. */
  public get isDataModeOverridden(): boolean {
    return Endge.context.isDataModeOverridden
  }

  /** Обновляет mock-режим без перестроения неизменяемого структурного контекста. */
  public setMockEnabled(enabled: boolean): void {
    const mode = enabled ? 'mock' : 'live'
    configuratorDataModeRepository.write(this._activeBackendURL(), Endge.workspace.current.identity, mode)
    Endge.context.setDataMode(mode)
    this._notify()
  }

  /** Возвращает выполнение данных к сохранённому значению Workspace по умолчанию. */
  public clearDataModeOverride(): void {
    configuratorDataModeRepository.clear(this._activeBackendURL(), Endge.workspace.current.identity)
    Endge.context.clearDataModeOverride()
    this._notify()
  }

  private _activeBackendURL(): string {
    return this._backendConfig?.activeBackendURL ?? getEndgeBackendConfig().activeBackendURL
  }
}

/** Допускает для auth только явно выделенный VITE_ENDGE_AUTH_* namespace host-приложения. */
function readAuthVariableRecord(env: ImportMetaEnv): Readonly<Record<string, string>> {
  const variables: Record<string, string> = {}
  for (const [key, rawValue] of Object.entries(env as unknown as Record<string, unknown>)) {
    if (!key.startsWith('VITE_ENDGE_AUTH_') || typeof rawValue !== 'string') {
      continue
    }
    const ref = key.slice('VITE_ENDGE_AUTH_'.length).trim()
    const value = rawValue.trim()
    if (ref && value) {
      variables[ref] = value
    }
  }
  return variables
}

function sameContext(left: Partial<EndgeExecutionContext>, right: Partial<EndgeExecutionContext>): boolean {
  return left.tenantIdentity === right.tenantIdentity
    && left.projectIdentity === right.projectIdentity
    && left.environmentIdentity === right.environmentIdentity
}
