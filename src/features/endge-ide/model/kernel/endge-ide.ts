import type { RuntimeInspectionLease } from '@endge/core'
import type { RaphDebugLease } from '@endge/raph'
import type { EndgeIDEContextPort, EndgeIDEModules } from '@/features/endge-ide/domain/types/endge-ide-modules.type'

import { Endge } from '@endge/core'
import { Raph } from '@endge/raph'

import { isIDERuntimeDebuggerDisabled, isIDEWidgetsDisabled } from '@/features/endge-ide/model/config/endge-ide-debug-flags'
import { createEndgeIDEModules } from '@/features/endge-ide/model/config/modules.config'

/** Route-scoped federation for the mounted IDE workspace. */
export class EndgeIDE {
  private static _modules: EndgeIDEModules | null = null
  private static _initialized = false
  private static _hasActiveModules = false
  private static _initialization: Promise<void> | null = null
  private static _raphDebugLease: RaphDebugLease | null = null
  private static _destroyedSnapshotsLease: RuntimeInspectionLease | null = null

  private constructor() {}

  public static setup(context: EndgeIDEContextPort): void {
    this._modules ??= createEndgeIDEModules(context)
  }

  public static get demonstration() {
    return this._requireModules().demonstration
  }

  public static get domainDrag() {
    return this._requireModules().domainDrag
  }

  public static get domainTransfer() {
    return this._requireModules().domainTransfer
  }

  public static get modals() {
    return this._requireModules().modals
  }

  public static get tabs() {
    return this._requireModules().tabs
  }

  public static get uiState() {
    return this._requireModules().uiState
  }

  public static get widgets() {
    return this._requireModules().widgets
  }

  public static get hotkeys() {
    return this._requireModules().hotkeys
  }

  public static get runtimePreview() {
    return this._requireModules().runtimePreview
  }

  public static get problems() {
    return this._requireModules().problems
  }

  public static get sourceEditorDialogs() {
    return this._requireModules().sourceEditorDialogs
  }

  public static get authProfileEditors() {
    return this._requireModules().authProfileEditors
  }

  public static get integrations() {
    return this._requireModules().integrations
  }

  public static get busy() {
    return this._requireModules().busy.state
  }

  public static get agentTableActions() {
    return this._requireModules().agentTableActions
  }

  public static runBusy<T>(operation: Promise<T>): Promise<T> {
    return this._requireModules().busy.run(operation)
  }

  public static async init(): Promise<void> {
    if (this._initialized) {
      return
    }
    if (this._initialization) {
      return this._initialization
    }

    this._initialization = this._initialize().finally(() => {
      this._initialization = null
    })
    return this._initialization
  }

  public static async reset(): Promise<void> {
    await this._initialization?.catch(() => undefined)
    if (!this._hasActiveModules) {
      return
    }

    await this._resetModules()
  }

  private static async _resetModules(): Promise<void> {
    const modules = this._requireModules()
    try {
      await modules.integrations.reset()
      modules.problems.reset()
      modules.sourceEditorDialogs.reset()
      modules.authProfileEditors.reset()
      modules.runtimePreview.reset()
      modules.hotkeys.reset()
      modules.tabs.reset()
      if (!isIDEWidgetsDisabled()) {
        modules.widgets.reset()
      }
      modules.modals.reset()
      modules.demonstration.reset()
      modules.domainDrag.reset()
      modules.busy.reset()
      modules.agentTableActions.reset()
      Endge.runtimeDebugger.reset()
    }
    finally {
      this._raphDebugLease?.release()
      this._raphDebugLease = null
      this._destroyedSnapshotsLease?.release()
      this._destroyedSnapshotsLease = null
      this._initialized = false
      this._hasActiveModules = false
    }
  }

  private static async _initialize(): Promise<void> {
    const modules = this._requireModules()
    const widgetsDisabled = isIDEWidgetsDisabled()
    const runtimeDebuggerDisabled = isIDERuntimeDebuggerDisabled()

    this._hasActiveModules = true
    try {
      this._raphDebugLease = Raph.debug.acquire()
      this._destroyedSnapshotsLease = Endge.runtime.acquireDestroyedHostSnapshots(50)
      modules.demonstration.init()
      modules.modals.init()
      if (!widgetsDisabled) {
        modules.widgets.init()
      }
      modules.tabs.init()
      this._configureHotkeys()
      modules.hotkeys.init()
      modules.runtimePreview.init()
      modules.problems.init()
      await modules.integrations.init()

      if (!runtimeDebuggerDisabled) {
        Endge.runtimeDebugger.startListening()
      }
      this._initialized = true
    }
    catch (error) {
      await this._resetModules()
      throw error
    }
  }

  private static _configureHotkeys(): void {
    const modules = this._requireModules()
    modules.hotkeys.setSaveHandler(() => modules.tabs.save())
    modules.hotkeys.setCloseTabHandler(() => modules.tabs.closeActiveTabFromHotkey())
    modules.hotkeys.setCreateDocumentHandler(() => modules.modals.openCreateDocument())
    modules.hotkeys.setRunRuntimeHandler(() => {
      const editor = modules.tabs.documentEditorModel.value
      if (!modules.runtimePreview.canLaunchEditor(editor)) {
        return false
      }
      void modules.runtimePreview.launchEditor(editor)
      return true
    })
    modules.hotkeys.setReturnToProjectHandler(() => {
      return modules.problems.returnToProject() || modules.runtimePreview.returnToProject()
    })
  }

  private static _requireModules(): EndgeIDEModules {
    if (!this._modules) {
      throw new Error('[EndgeIDE] setup() must be called before accessing IDE modules')
    }
    return this._modules
  }
}
