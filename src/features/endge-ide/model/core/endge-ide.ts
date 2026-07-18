import { Endge, EndgeModuleController } from '@endge/core'

import { isBusy, runBusy } from '@/features/endge-ide/model/core/endge-ide-busy.ts'
import { EndgeIDEConsole } from '@/features/endge-ide/model/core/endge-ide-console.ts'
import { isIDERuntimeDebuggerDisabled, isIDEWidgetsDisabled } from '@/features/endge-ide/model/core/endge-ide-debug-flags.ts'
import { EndgeIDEDemonstration } from '@/features/endge-ide/model/core/endge-ide-demonstration.ts'
import { EndgeIDEFlowCatalog } from '@/features/endge-ide/model/core/endge-ide-flow-catalog.ts'
import { EndgeIDEHotkeys } from '@/features/endge-ide/model/core/endge-ide-hotkeys.ts'
import { EndgeIDEInspector } from '@/features/endge-ide/model/core/endge-ide-inspector.ts'
import { EndgeIDEModals } from '@/features/endge-ide/model/core/endge-ide-modals.ts'
import { EndgeIDETabs } from '@/features/endge-ide/model/core/endge-ide-tabs.ts'
import { EndgeIDEWidgets } from '@/features/endge-ide/model/core/endge-ide-widgets.ts'
import { startDiagnosticsChannelListener } from '@/features/endge-ide/model/pulse/diagnostics-register.ts'
import { EndgeIDERuntimePreview } from '@/features/endge-ide/model/runtime-preview/endge-ide-runtime-preview'

const noopModule = {
  init(): void {},
  reset(): void {},
}

export class EndgeIDE extends EndgeModuleController {
  public static readonly _host: EndgeIDE = new EndgeIDE()

  private _console: EndgeIDEConsole = new EndgeIDEConsole()
  private _demonstration: EndgeIDEDemonstration = new EndgeIDEDemonstration()
  private _modals: EndgeIDEModals = new EndgeIDEModals()
  private _tabs: EndgeIDETabs = new EndgeIDETabs()
  private _widgets: EndgeIDEWidgets = new EndgeIDEWidgets()
  private _inspector: EndgeIDEInspector = new EndgeIDEInspector()
  private _hotkeys: EndgeIDEHotkeys = new EndgeIDEHotkeys()
  private _flowCatalog: EndgeIDEFlowCatalog = new EndgeIDEFlowCatalog()
  private _runtimePreview: EndgeIDERuntimePreview = new EndgeIDERuntimePreview()

  public static init(): void {
    const host = EndgeIDE._host
    const widgetsDisabled = isIDEWidgetsDisabled()
    const runtimeDebuggerDisabled = isIDERuntimeDebuggerDisabled()

    console.warn('[EndgeIDE] init', {
      widgetsDisabled,
      runtimeDebuggerDisabled,
    })

    host.registerModule('console', host._console)
    host.registerModule('demonstration', host._demonstration)
    host.registerModule('modals', host._modals)
    host.registerModule('widgets', widgetsDisabled ? noopModule : host._widgets)
    host.registerModule('tabs', host._tabs)
    host.registerModule('inspector', host._inspector)
    host.registerModule('hotkeys', host._hotkeys)
    host.registerModule('flowCatalog', host._flowCatalog)
    host.registerModule('runtimePreview', host._runtimePreview)
    host._hotkeys.setSaveHandler(() => {
      EndgeIDE.tabs.save()
    })
    host._hotkeys.setCloseTabHandler(() => {
      const id = EndgeIDE.tabs.activeTabId.value
      if (id) {
        EndgeIDE.tabs.closeTab(id)
      }
    })
    host._hotkeys.setCreateDocumentHandler(() => {
      EndgeIDE.modals.openCreateDocument()
    })
    host._hotkeys.setRunRuntimeHandler(() => {
      const editor = EndgeIDE.tabs.documentEditorModel.value
      if (!EndgeIDE.runtimePreview.canLaunchEditor(editor)) {
        return false
      }
      void EndgeIDE.runtimePreview.launchEditor(editor)
      return true
    })
    host._hotkeys.setReturnToProjectHandler(() => EndgeIDE.runtimePreview.returnToProject())
    host.init()
    if (!runtimeDebuggerDisabled) {
      Endge.runtimeDebugger.startListening()
      startDiagnosticsChannelListener()
    }
  }

  public static reset(): void {
    EndgeIDE._host.reset()
  }

  public static get console(): EndgeIDEConsole {
    return EndgeIDE._host._console
  }

  public static get demonstration(): EndgeIDEDemonstration {
    return EndgeIDE._host._demonstration
  }

  public static get modals(): EndgeIDEModals {
    return EndgeIDE._host._modals
  }

  public static get tabs(): EndgeIDETabs {
    return EndgeIDE._host._tabs
  }

  public static get widgets(): EndgeIDEWidgets {
    return EndgeIDE._host._widgets
  }

  public static get inspector(): EndgeIDEInspector {
    return EndgeIDE._host._inspector
  }

  public static get hotkeys(): EndgeIDEHotkeys {
    return EndgeIDE._host._hotkeys
  }

  public static get flowCatalog(): EndgeIDEFlowCatalog {
    return EndgeIDE._host._flowCatalog
  }

  public static get runtimePreview(): EndgeIDERuntimePreview {
    return EndgeIDE._host._runtimePreview
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
