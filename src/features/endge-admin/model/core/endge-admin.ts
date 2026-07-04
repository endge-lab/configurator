import { Endge, EndgeModuleController } from '@endge/core'

import { isBusy, runBusy } from '@/features/endge-admin/model/core/endge-admin-busy.ts'
import { EndgeAdminConsole } from '@/features/endge-admin/model/core/endge-admin-console.ts'
import { EndgeAdminDemonstration } from '@/features/endge-admin/model/core/endge-admin-demonstration.ts'
import { EndgeAdminDocs } from '@/features/endge-admin/model/core/endge-admin-docs.ts'
import { EndgeAdminFlowCatalog } from '@/features/endge-admin/model/core/endge-admin-flow-catalog.ts'
import { EndgeAdminHotkeys } from '@/features/endge-admin/model/core/endge-admin-hotkeys.ts'
import { EndgeAdminInspector } from '@/features/endge-admin/model/core/endge-admin-inspector.ts'
import { EndgeAdminModals } from '@/features/endge-admin/model/core/endge-admin-modals.ts'
import { EndgeAdminTabs } from '@/features/endge-admin/model/core/endge-admin-tabs.ts'
import { isAdminRuntimeDebuggerDisabled, isAdminWidgetsDisabled } from '@/features/endge-admin/model/core/endge-admin-debug-flags.ts'
import { EndgeAdminWidgets } from '@/features/endge-admin/model/core/endge-admin-widgets.ts'
import { startDiagnosticsChannelListener } from '@/features/endge-admin/model/pulse/diagnostics-register.ts'

const noopModule = {
  init(): void {},
  reset(): void {},
}

export class EndgeAdmin extends EndgeModuleController {
  public static readonly _host: EndgeAdmin = new EndgeAdmin()

  private _console: EndgeAdminConsole = new EndgeAdminConsole()
  private _demonstration: EndgeAdminDemonstration = new EndgeAdminDemonstration()
  private _modals: EndgeAdminModals = new EndgeAdminModals()
  private _tabs: EndgeAdminTabs = new EndgeAdminTabs()
  private _widgets: EndgeAdminWidgets = new EndgeAdminWidgets()
  private _inspector: EndgeAdminInspector = new EndgeAdminInspector()
  private _docs: EndgeAdminDocs = new EndgeAdminDocs()
  private _hotkeys: EndgeAdminHotkeys = new EndgeAdminHotkeys()
  private _flowCatalog: EndgeAdminFlowCatalog = new EndgeAdminFlowCatalog()

  public static init(): void {
    const host = EndgeAdmin._host
    const widgetsDisabled = isAdminWidgetsDisabled()
    const runtimeDebuggerDisabled = isAdminRuntimeDebuggerDisabled()

    console.info('[EndgeAdmin] init', {
      widgetsDisabled,
      runtimeDebuggerDisabled,
    })

    host.registerModule('console', host._console)
    host.registerModule('demonstration', host._demonstration)
    host.registerModule('modals', host._modals)
    host.registerModule('widgets', widgetsDisabled ? noopModule : host._widgets)
    host.registerModule('tabs', host._tabs)
    host.registerModule('inspector', host._inspector)
    host.registerModule('docs', host._docs)
    host.registerModule('hotkeys', host._hotkeys)
    host.registerModule('flowCatalog', host._flowCatalog)
    host._hotkeys.setSaveHandler(() => {
      EndgeAdmin.tabs.save()
    })
    host._hotkeys.setCloseTabHandler(() => {
      const id = EndgeAdmin.tabs.activeTabId.value
      if (id) { EndgeAdmin.tabs.closeTab(id) }
    })
    host._hotkeys.setCreateDocumentHandler(() => {
      EndgeAdmin.modals.openCreateDocument()
    })
    host.init()
    if (!runtimeDebuggerDisabled) {
      Endge.runtimeDebugger.startListening()
      startDiagnosticsChannelListener()
    }
  }

  public static reset(): void {
    EndgeAdmin._host.reset()
  }

  public static get console(): EndgeAdminConsole {
    return EndgeAdmin._host._console
  }

  public static get demonstration(): EndgeAdminDemonstration {
    return EndgeAdmin._host._demonstration
  }

  public static get modals(): EndgeAdminModals {
    return EndgeAdmin._host._modals
  }

  public static get tabs(): EndgeAdminTabs {
    return EndgeAdmin._host._tabs
  }

  public static get widgets(): EndgeAdminWidgets {
    return EndgeAdmin._host._widgets
  }

  public static get inspector(): EndgeAdminInspector {
    return EndgeAdmin._host._inspector
  }

  public static get docs(): EndgeAdminDocs {
    return EndgeAdmin._host._docs
  }

  public static get hotkeys(): EndgeAdminHotkeys {
    return EndgeAdmin._host._hotkeys
  }

  public static get flowCatalog(): EndgeAdminFlowCatalog {
    return EndgeAdmin._host._flowCatalog
  }

  /** Единый флаг занятости (оверлей при сохранении/удалении/переименовании/перемещении). */
  public static get busy(): typeof isBusy {
    return isBusy
  }

  /** Выполнить асинхронную операцию с показом оверлея. */
  public static runBusy<T>(promise: Promise<T>): Promise<T> {
    return runBusy(promise)
  }
}
