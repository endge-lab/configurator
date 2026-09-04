import type { AuthProfileSchema, OidcBrowserSession_Adapter } from '@endge/core'
import type { Ref, ShallowRef } from 'vue'
import type { EndgeIDEContextPort } from '@/features/endge-ide/domain/types/endge-ide-modules.type'
import type {
  RuntimePreviewAuthPrompt,
  RuntimePreviewLaunchRequest,
  RuntimePreviewLifecycleState,
  RuntimePreviewOccurrencePrompt,
  RuntimePreviewTreeNode,
} from '@/features/endge-ide/domain/types/runtime-preview.types'

import type { RuntimeTreeExpansionPreset } from '@/features/endge-ide/services/runtime-preview/runtime-tree-view-state'
import { AuthInteractionRequiredError, Endge } from '@endge/core'
import { computed, ref, shallowRef } from 'vue'
import { toast } from 'vue-sonner'

import { getLayoutState, showWidget } from '@/app/ui/layouts/grid/layout'
import { ENDGE_IDE_RUNTIME_TREE_WIDGET_ID, runtimePreviewKey } from '@/features/endge-ide/domain/types/runtime-preview.types'
import { getConfiguratorOidcPopupCallbackURL } from '@/features/endge-ide/services/auth/oidc-browser-url'
import { collectRuntimePreviewAuthProfiles } from '@/features/endge-ide/services/runtime-preview/runtime-preview-auth'
import { validateRuntimePreviewContext } from '@/features/endge-ide/services/runtime-preview/runtime-preview-context-guard'
import { readRuntimePreviewHistory, writeRuntimePreviewHistory } from '@/features/endge-ide/services/runtime-preview/runtime-preview-history'
import { RuntimePreviewInstance } from '@/features/endge-ide/services/runtime-preview/runtime-preview-instance'
import { createRuntimePreviewLaunchRequest } from '@/features/endge-ide/services/runtime-preview/runtime-preview-launch-request'
import { findRuntimePreviewOccurrences } from '@/features/endge-ide/services/runtime-preview/runtime-preview-occurrence'

/** Постоянное многоуровневое рабочее пространство Runtime Preview, принадлежащее EndgeIDE. */
export class EndgeIDERuntimePreview_Module {
  private readonly _entries = shallowRef<RuntimePreviewInstance[]>([])
  private readonly _selectedEntryKey = ref<string | null>(null)
  private readonly _occurrencePrompt = shallowRef<RuntimePreviewOccurrencePrompt | null>(null)
  private readonly _authPrompt = shallowRef<RuntimePreviewAuthPrompt | null>(null)
  private readonly _treeExpansionRequest = shallowRef<{
    id: number
    preset: RuntimeTreeExpansionPreset
  } | null>(null)

  public readonly entries: Readonly<ShallowRef<RuntimePreviewInstance[]>> = this._entries
  public readonly selectedEntryKey: Readonly<Ref<string | null>> = this._selectedEntryKey
  public readonly selectedEntry = computed(() => this.get(this.selectedEntryKey.value))
  public readonly selectedNode = computed(() => this.selectedEntry.value?.selectedNode.value ?? null)
  public readonly occurrencePrompt: Readonly<ShallowRef<RuntimePreviewOccurrencePrompt | null>> = this._occurrencePrompt
  public readonly authPrompt: Readonly<ShallowRef<RuntimePreviewAuthPrompt | null>> = this._authPrompt
  public readonly treeExpansionRequest: Readonly<ShallowRef<{
    id: number
    preset: RuntimeTreeExpansionPreset
  } | null>> = this._treeExpansionRequest

  private readonly _instances = new Map<string, RuntimePreviewInstance>()
  private _runtimeOff: (() => void) | null = null
  private _scopeOff: (() => void) | null = null
  private _surfaceOff: (() => void) | null = null
  private _authInteractionOff: (() => void) | null = null
  private _initialized = false
  private _treeExpansionRequestId = 0
  private _resolveOccurrencePrompt: ((choice: string | 'standalone' | null) => void) | null = null
  private _resolveAuthPrompt: ((authorized: boolean) => void) | null = null
  private readonly _oidcSources = new Map<string, OidcBrowserSession_Adapter>()

  public constructor(private readonly _context: EndgeIDEContextPort) {}

  public init(): void {
    if (this._initialized) {
      return
    }
    this._runtimeOff = Endge.runtime.subscribe(() => this._refresh())
    this._scopeOff = Endge.runtime.scopes.subscribe(() => this._refresh())
    this._surfaceOff = this._context.registerSurface('endge-ide-runtime-preview', {
      beforeContextReset: () => this.disposeAll(),
      afterContextBoot: () => this._restoreRememberedEntries(),
    })
    this._authInteractionOff = Endge.auth.onInteractionRequired(error => this._handleInteractionRequired(error))
    this._restoreRememberedEntries()
    this._initialized = true
  }

  public reset(): void {
    this._runtimeOff?.()
    this._scopeOff?.()
    this._surfaceOff?.()
    this._authInteractionOff?.()
    this._runtimeOff = null
    this._scopeOff = null
    this._surfaceOff = null
    this._authInteractionOff = null
    this._initialized = false
    void this.disposeAll()
  }

  public async launch(rawTarget: RuntimePreviewLaunchRequest): Promise<boolean> {
    return this._launch(rawTarget, true)
  }

  /** Запускает цели сохранённых документов в порядке выбора и однократно раскрывает дерево после всей группы. */
  public async launchAll(rawTargets: readonly RuntimePreviewLaunchRequest[]): Promise<number> {
    const targets = [...new Map(rawTargets.map(target => [runtimePreviewKey(target), target])).values()]
    let launched = 0
    for (const target of targets) {
      if (await this._launch(target, false)) {
        launched += 1
      }
    }
    showWidget(ENDGE_IDE_RUNTIME_TREE_WIDGET_ID)
    return launched
  }

  private async _launch(rawTarget: RuntimePreviewLaunchRequest, revealTree: boolean): Promise<boolean> {
    const identity = String(rawTarget.identity ?? '').trim()
    if (!identity) {
      toast.error('Невозможно запустить Runtime Preview', { description: 'У документа отсутствует identity.' })
      return false
    }
    const target = { entityType: rawTarget.entityType, identity } as const
    const validation = validateRuntimePreviewContext(target, this._context.isSwitchingContext)
    if (!validation.valid) {
      toast.error(validation.message ?? 'Runtime Preview недоступен', { description: validation.description })
      return false
    }
    const mockMode = Endge.context.isMockEnabled
    let missingMockProfiles: AuthProfileSchema[] = []
    let mockAuthWarning: string | null = null
    try {
      const profiles = collectRuntimePreviewAuthProfiles(rawTarget)
      if (mockMode) {
        missingMockProfiles = await this._findMissingInteractiveProfiles(profiles)
      }
      else if (!await this._ensureProfiles(profiles)) {
        return false
      }
    }
    catch (error) {
      const description = error instanceof Error ? error.message : String(error)
      if (mockMode) {
        mockAuthWarning = description
      }
      else {
        toast.error('Не удалось подготовить авторизацию Runtime Preview', { description })
        return false
      }
    }

    const key = runtimePreviewKey(target)
    let instance = this._instances.get(key)
    if (!instance) {
      instance = new RuntimePreviewInstance(target)
      this._instances.set(key, instance)
      this._syncEntries()
      this._persistEntries()
    }
    this._selectedEntryKey.value = key
    if (revealTree) {
      showWidget(ENDGE_IDE_RUNTIME_TREE_WIDGET_ID)
    }
    try {
      await instance.launch(rawTarget.draft, rawTarget.contextual, mockMode)
      if (mockMode && (missingMockProfiles.length > 0 || mockAuthWarning)) {
        this._warnMockAuthorization(missingMockProfiles, mockAuthWarning)
      }
      return true
    }
    catch (error) {
      if (error instanceof AuthInteractionRequiredError) {
        return false
      }
      toast.error('Не удалось запустить Runtime Preview', {
        description: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  /** Запускает активный редактор, только если тип его документа имеет runtime-контракт. */
  public async launchEditor(editor: unknown): Promise<boolean> {
    const request = createRuntimePreviewLaunchRequest(editor)
    if (!request) {
      return false
    }
    if (request.entityType !== 'composition' && request.entityType !== 'component-sfc') {
      return this.launch(request)
    }

    const projectIdentity = Endge.context.getExecutionContext().projectIdentity
    const occurrences = findRuntimePreviewOccurrences(request, projectIdentity)
    if (occurrences.length === 0) {
      return this.launch(request)
    }

    let occurrence = occurrences.length === 1 && (!occurrences[0]!.mayExecuteQueries || Endge.context.isMockEnabled)
      ? occurrences[0]!
      : null
    if (!occurrence) {
      const choice = await this._requestOccurrenceChoice({
        target: request,
        occurrences,
        liveMode: !Endge.context.isMockEnabled,
      })
      if (choice === 'standalone') {
        return this.launch(request)
      }
      if (!choice) {
        return false
      }
      occurrence = occurrences.find(item => item.id === choice) ?? null
      if (!occurrence) {
        return false
      }
    }

    return this.launch({
      entityType: 'project',
      identity: occurrence.projectIdentity,
      draft: request.draft,
      contextual: {
        target: request,
        occurrence,
      },
    })
  }

  public canLaunchEditor(editor: unknown): boolean {
    return createRuntimePreviewLaunchRequest(editor) != null
  }

  /** Запрашивает однократный preset раскрытия у поверхности Runtime Tree. */
  public requestTreeExpansion(preset: RuntimeTreeExpansionPreset): void {
    this._treeExpansionRequest.value = {
      id: ++this._treeExpansionRequestId,
      preset,
    }
  }

  public consumeTreeExpansionRequest(requestId: number): void {
    if (this.treeExpansionRequest.value?.id === requestId) {
      this._treeExpansionRequest.value = null
    }
  }

  public chooseOccurrence(choice: string | 'standalone' | null): void {
    const resolve = this._resolveOccurrencePrompt
    this._resolveOccurrencePrompt = null
    this._occurrencePrompt.value = null
    resolve?.(choice)
  }

  /** Выполняет следующий OIDC popup исключительно из пользовательского клика. */
  public async authorizeNextProfile(): Promise<void> {
    const prompt = this.authPrompt.value
    if (!prompt || prompt.pending) {
      return
    }
    const profile = prompt.profiles[prompt.currentIndex]
    const source = profile ? this._oidcSources.get(profile.identity) : null
    if (!profile || !source) {
      return
    }
    this._authPrompt.value = { ...prompt, pending: true, error: null }
    try {
      await source.loginPopup()
      Endge.auth.session.connect(profile.identity, source)
      const token = await Endge.auth.session.ensureProfile(profile)
      if (!token) {
        throw new Error(`OIDC session не создана: ${profile.identity}`)
      }
      const nextIndex = prompt.currentIndex + 1
      if (nextIndex >= prompt.profiles.length) {
        const resolve = this._resolveAuthPrompt
        this._resolveAuthPrompt = null
        this._authPrompt.value = null
        resolve?.(true)
      }
      else {
        this._authPrompt.value = { profiles: prompt.profiles, currentIndex: nextIndex, pending: false, error: null }
      }
    }
    catch (error) {
      this._authPrompt.value = {
        ...prompt,
        pending: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /** Отменяет preflight и не создаёт частично запущенный Runtime Preview. */
  public cancelAuthorization(): void {
    const resolve = this._resolveAuthPrompt
    this._resolveAuthPrompt = null
    this._authPrompt.value = null
    resolve?.(false)
  }

  /** Навигация по Escape: закрывает Runtime Preview без остановки его runtime. */
  public returnToProject(): boolean {
    const area = getLayoutState().widgets.value.areas.left
    if (!area.expanded || area.activeWidget !== ENDGE_IDE_RUNTIME_TREE_WIDGET_ID) {
      return false
    }
    showWidget('project')
    return true
  }

  public get(key: string | null): RuntimePreviewInstance | null {
    return key ? this._instances.get(key) ?? null : null
  }

  public async select(entryKey: string, nodeId: string): Promise<void> {
    const instance = this.get(entryKey)
    if (!instance) {
      return
    }
    this._selectedEntryKey.value = entryKey
    await instance.select(nodeId)
  }

  public lifecycleState(entryKey: string, node: RuntimePreviewTreeNode): RuntimePreviewLifecycleState {
    return this.get(entryKey)?.lifecycleState(node) ?? 'disposed'
  }

  public async pause(instanceId: string): Promise<void> {
    await this.get(instanceId)?.pause()
  }

  public async resume(instanceId: string): Promise<void> {
    await this.get(instanceId)?.resume()
  }

  public async stop(instanceId: string): Promise<void> {
    await this.get(instanceId)?.stop()
  }

  public async restart(instanceId: string): Promise<void> {
    await this.get(instanceId)?.restart()
  }

  public async remove(instanceId: string): Promise<void> {
    const instance = this.get(instanceId)
    if (!instance) {
      return
    }
    await instance.dispose()
    this._instances.delete(instanceId)
    if (this.selectedEntryKey.value === instanceId) {
      this._selectedEntryKey.value = this.entries.value.find(item => item.key !== instanceId)?.key ?? null
    }
    this._syncEntries()
    this._persistEntries()
  }

  public async pauseAll(): Promise<void> {
    await Promise.all(this.entries.value.map(instance => instance.pause()))
  }

  /** Запускает все неактивные корни и возобновляет корни, приостановленные пользователем. */
  public async startAll(): Promise<void> {
    await Promise.all(this.entries.value.map((instance) => {
      if (instance.status.value === 'paused') {
        return instance.resume()
      }
      if (instance.status.value === 'inactive' || instance.status.value === 'stopped' || instance.status.value === 'error') {
        return instance.restart()
      }
      return Promise.resolve()
    }))
  }

  public async stopAll(): Promise<void> {
    await Promise.all(this.entries.value.map(instance => instance.stop()))
  }

  /** Пересоздаёт все запомненные корни Runtime Preview и их вложенные runtime. */
  public async restartAll(): Promise<void> {
    await Promise.all(this.entries.value.map(instance => instance.restart()))
  }

  /** Пересоздаёт смонтированные корни preview, чтобы Store инициализировался в новом режиме данных. */
  public async restartForDataModeChange(): Promise<void> {
    const candidates = this.entries.value
      .map(instance => ({ instance, state: instance.status.value }))
      .filter(item =>
        item.state === 'active' || item.state === 'paused' || item.state === 'preparing',
      )
    const skipped = candidates.filter(item => item.instance.requiresExplicitDataModeRestartConfirmation)
    const mounted = candidates.filter(item => !item.instance.requiresExplicitDataModeRestartConfirmation)
    if (skipped.length > 0) {
      toast.warning('Контекстный Preview не перезапущен автоматически', {
        description: 'В выбранной ветке есть mount Query. Перезапустите Preview вручную после проверки Live mode.',
      })
    }

    await Promise.all(mounted.map(async ({ instance, state }) => {
      await instance.restart()
      if (state === 'paused') {
        await instance.pause()
      }
    }))
  }

  /** Удаляет все запомненные корни и освобождает runtime, которыми они ещё владеют. */
  public async removeAll(): Promise<void> {
    await this.disposeAll()
    writeRuntimePreviewHistory([])
  }

  public async pauseNode(entryKey: string, nodeId: string): Promise<void> {
    await this.get(entryKey)?.pauseNode(nodeId)
  }

  public async resumeNode(entryKey: string, nodeId: string): Promise<void> {
    await this.get(entryKey)?.resumeNode(nodeId)
  }

  public async stopNode(entryKey: string, nodeId: string): Promise<void> {
    await this.get(entryKey)?.stopNode(nodeId)
  }

  public async restartNode(entryKey: string, nodeId: string): Promise<void> {
    await this.get(entryKey)?.restartNode(nodeId)
  }

  public async pauseSelected(): Promise<void> {
    const instance = this.selectedEntry.value
    const node = this.selectedNode.value
    if (instance && node) {
      await instance.pauseNode(node.id)
    }
  }

  public async resumeSelected(): Promise<void> {
    const instance = this.selectedEntry.value
    const node = this.selectedNode.value
    if (instance && node) {
      await instance.resumeNode(node.id)
    }
  }

  public async stopSelected(): Promise<void> {
    const instance = this.selectedEntry.value
    const node = this.selectedNode.value
    if (instance && node) {
      await instance.stopNode(node.id)
    }
  }

  public async restartSelected(): Promise<void> {
    const instance = this.selectedEntry.value
    const node = this.selectedNode.value
    if (instance && node) {
      await instance.restartNode(node.id)
    }
  }

  public async disposeAll(): Promise<void> {
    this.chooseOccurrence(null)
    this.cancelAuthorization()
    const instances = [...this._instances.values()]
    this._instances.clear()
    this._entries.value = []
    this._selectedEntryKey.value = null
    await Promise.all(instances.map(instance => instance.dispose()))
  }

  private _refresh(): void {
    for (const instance of this._instances.values()) {
      instance.refresh()
    }
  }

  private _syncEntries(): void {
    this._entries.value = [...this._instances.values()]
  }

  private _restoreRememberedEntries(): void {
    if (this._instances.size > 0) {
      return
    }
    for (const target of readRuntimePreviewHistory()) {
      const instance = new RuntimePreviewInstance(target)
      this._instances.set(instance.key, instance)
    }
    this._syncEntries()
  }

  private _persistEntries(): void {
    writeRuntimePreviewHistory(this.entries.value.map(instance => instance.target))
  }

  private _requestOccurrenceChoice(
    prompt: RuntimePreviewOccurrencePrompt,
  ): Promise<string | 'standalone' | null> {
    this.chooseOccurrence(null)
    this._occurrencePrompt.value = prompt
    return new Promise((resolve) => {
      this._resolveOccurrencePrompt = resolve
    })
  }

  private async _ensureProfiles(profiles: AuthProfileSchema[]): Promise<boolean> {
    const missing: AuthProfileSchema[] = []
    for (const profile of profiles) {
      if (profile.adapterId !== 'oidc') {
        await Endge.auth.session.ensureProfile(profile)
        continue
      }
      const source = this._oidcSource(profile)
      this._oidcSources.set(profile.identity, source)
      Endge.auth.session.connect(profile.identity, source)
      if (await source.hasSession()) {
        await Endge.auth.session.ensureProfile(profile)
      }
      else { missing.push(profile) }
    }
    if (missing.length === 0) {
      return true
    }
    this.cancelAuthorization()
    this._authPrompt.value = { profiles: missing, currentIndex: 0, pending: false, error: null }
    return new Promise((resolve) => {
      this._resolveAuthPrompt = resolve
    })
  }

  /** Проверяет только наличие browser session, не блокируя запуск mock preview. */
  private async _findMissingInteractiveProfiles(profiles: AuthProfileSchema[]): Promise<AuthProfileSchema[]> {
    const missing: AuthProfileSchema[] = []
    for (const profile of profiles) {
      if (profile.adapterId !== 'oidc') {
        continue
      }
      const source = this._oidcSource(profile)
      this._oidcSources.set(profile.identity, source)
      if (!await source.hasSession()) {
        missing.push(profile)
      }
    }
    return missing
  }

  private _warnMockAuthorization(profiles: AuthProfileSchema[], warning: string | null): void {
    const names = profiles.map(profile => profile.displayName || profile.identity).join(', ')
    toast.warning('Для запроса требуется авторизация', {
      description: warning
        ? `Runtime Preview продолжает работу в mock-режиме. ${warning}`
        : `Runtime Preview продолжает работу в mock-режиме без сессии: ${names}.`,
      ...(profiles.length > 0
        ? {
            action: {
              label: 'Авторизоваться',
              onClick: () => this._openAuthorizationPrompt(profiles),
            },
          }
        : {}),
    })
  }

  private _openAuthorizationPrompt(profiles: AuthProfileSchema[]): void {
    this.cancelAuthorization()
    this._authPrompt.value = { profiles, currentIndex: 0, pending: false, error: null }
  }

  private _oidcSource(profile: AuthProfileSchema): OidcBrowserSession_Adapter {
    const callback = getConfiguratorOidcPopupCallbackURL()
    return Endge.auth.createOidcSessionSource(profile, {
      redirectUri: callback,
      popupRedirectUri: callback,
      postLogoutRedirectUri: new URL(callback).origin,
      flow: 'popup',
    })
  }

  private async _authorizeAndRetry(
    profileIdentity: string,
    instance: RuntimePreviewInstance,
  ): Promise<void> {
    const profile = Endge.auth.profiles.requireActive(profileIdentity)
    if (profile.adapterId !== 'oidc') {
      await Endge.auth.session.ensureProfile(profile)
      await instance.restart()
      return
    }
    const source = this._oidcSources.get(profile.identity) ?? this._oidcSource(profile)
    this._oidcSources.set(profile.identity, source)
    Endge.auth.session.connect(profile.identity, source)
    await source.loginPopup()
    const token = await Endge.auth.session.ensureProfile(profile)
    if (!token) {
      throw new Error(`OIDC session не создана: ${profile.identity}`)
    }
    await instance.restart()
  }

  /** Обрабатывает авторизацию, запрошенную Query, появившимся после запуска Preview. */
  private _handleInteractionRequired(error: AuthInteractionRequiredError): void {
    const instance = this.selectedEntry.value
    if (!instance) {
      return
    }
    toast.error('Для запроса требуется авторизация', {
      description: error.message,
      action: {
        label: 'Авторизоваться и повторить',
        onClick: () => void this._authorizeAndRetry(error.profileIdentity, instance)
          .catch(authError => toast.error('Не удалось завершить вход', {
            description: authError instanceof Error ? authError.message : String(authError),
          })),
      },
    })
  }
}
