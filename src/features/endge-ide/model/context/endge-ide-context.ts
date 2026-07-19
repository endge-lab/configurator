import type { EndgeBootContext, EndgeExecutionContext } from '@endge/core'

import {
  Endge,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
} from '@endge/core'

import { registerEndgeMockProviders } from '@/features/endge-ide/model/bootstrap/endge-mock-providers'

export interface EndgeIDESurfaceLifecycle {
  beforeContextReset?: () => Promise<void> | void
  afterContextBoot?: () => Promise<void> | void
}

/**
 * Управляет boot и immutable execution context всей IDE.
 */
export class EndgeIDEContext {
  private static _isInitialized = false
  private static _isSwitchingContext = false
  private static _switchQueue: Promise<void> = Promise.resolve()
  private static _currentContext: Partial<EndgeExecutionContext> = {}
  private static _requestedContext: Partial<EndgeExecutionContext> = {}
  private static readonly _listeners = new Set<() => void>()
  private static readonly _surfaces = new Map<string, EndgeIDESurfaceLifecycle>()

  /**
   * Одноразово запускает прикладное ядро конфигуратора.
   * Передает boot-контекст в `Endge.boot()` и проверяет выбранный renderer adapter.
   */
  public static async init(options: { context?: Partial<EndgeExecutionContext> } = {}): Promise<void> {
    if (this._isInitialized) {
      return
    }

    const ctx = this._createBootContext(options.context)

    registerEndgeMockProviders()
    await Endge.boot(ctx)
    this._assertWorkspaceRendererReady()

    this._isInitialized = true
    this._currentContext = { ...Endge.context.getExecutionContext() }
    this._requestedContext = { ...this._currentContext }
    this._notify()
  }

  /** Полностью перезапускает Endge под новым immutable structural context. */
  public static async switchContext(next: Partial<EndgeExecutionContext>): Promise<void> {
    const requested = { ...this._requestedContext, ...next }
    if (
      next.projectIdentity != null
      && next.projectIdentity !== this._requestedContext.projectIdentity
      && !Object.prototype.hasOwnProperty.call(next, 'environmentIdentity')
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
  public static async reloadCurrentContext(): Promise<void> {
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
  public static async reset(): Promise<void> {
    await Endge.reset()
    this._isInitialized = false
    this._notify()
  }

  /**
   * Собирает Payload boot-контекст из env-переменных.
   */
  private static _createBootContext(context: Partial<EndgeExecutionContext> = {}): EndgeBootContext {
    const baseAPI = String(import.meta.env.VITE_PAYLOAD_BASE_URL || '').trim()
    const secret = String(import.meta.env.VITE_PAYLOAD_SECRET || '').trim()
    const workspaceIdentity = String(import.meta.env.VITE_ENDGE_WORKSPACE_IDENTITY || '').trim()
    const tenantIdentity = String(import.meta.env.VITE_ENDGE_TENANT_IDENTITY || '').trim()
    const projectIdentity = String(import.meta.env.VITE_ENDGE_PROJECT_IDENTITY || '').trim()
    const environmentIdentity = String(import.meta.env.VITE_ENDGE_ENVIRONMENT_IDENTITY || '').trim()
    if (!baseAPI || !secret) {
      throw new Error(
        '[EndgeIDE] VITE_PAYLOAD_BASE_URL and VITE_PAYLOAD_SECRET are required',
      )
    }

    return {
      dataProvider: 'payload',
      scope: workspaceIdentity ? { workspaceIdentity } : {},
      context: {
        ...(tenantIdentity ? { tenantIdentity } : {}),
        ...(projectIdentity ? { projectIdentity } : {}),
        ...(environmentIdentity ? { environmentIdentity } : {}),
        ...context,
      },
      vars: {
        ENDPOINT_AUTH: import.meta.env.VITE_ENDPOINT_AUTH,
        // Application env передаётся в ядро явно: @endge/core собирается отдельно
        // и не должен читать import.meta.env приложения из своего library bundle.
        SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
        SENTRY_ENVIRONMENT: import.meta.env.VITE_SENTRY_ENVIRONMENT,
        SENTRY_RELEASE: import.meta.env.VITE_SENTRY_RELEASE,
      },
      payload: { baseAPI, secret },
    }
  }

  private static async _performContextSwitch(
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
  public static subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  /** Registers a mounted application surface that owns runtime handles across context reboots. */
  public static registerSurface(id: string, lifecycle: EndgeIDESurfaceLifecycle): () => void {
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

  private static async _runSurfaceHook(hook: keyof EndgeIDESurfaceLifecycle): Promise<void> {
    for (const lifecycle of this._surfaces.values()) {
      await lifecycle[hook]?.()
    }
  }

  private static _notify(): void {
    for (const listener of this._listeners) {
      listener()
    }
  }

  private static _assertWorkspaceRendererReady(): void {
    const adapter = Endge.uiRegistry.adapters.requireActive({
      protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
      protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
      renderer: 'vue',
      requiredRendererKeys: ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
    })

    if (adapter.id !== Endge.workspace.defaultSfcAdapterId) {
      throw new Error(
        `[EndgeIDE] active SFC adapter "${adapter.id}" does not match workspace adapter "${Endge.workspace.defaultSfcAdapterId}"`,
      )
    }
  }

  /**
   * Показывает, был ли уже выполнен успешный boot текущего приложения.
   */
  public static get isInitialized(): boolean {
    return this._isInitialized
  }

  static get isSwitchingContext(): boolean {
    return this._isSwitchingContext
  }

  static get currentContext(): Readonly<Partial<EndgeExecutionContext>> {
    return this._currentContext
  }
}

function sameContext(left: Partial<EndgeExecutionContext>, right: Partial<EndgeExecutionContext>): boolean {
  return left.tenantIdentity === right.tenantIdentity
    && left.projectIdentity === right.projectIdentity
    && left.environmentIdentity === right.environmentIdentity
}
