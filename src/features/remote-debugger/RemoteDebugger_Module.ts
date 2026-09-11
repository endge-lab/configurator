import type { BridgeDebugClient, BridgeDebugSession, EndgeCommand } from '@endge/core'
import { Endge } from '@endge/core'
import { readonly, shallowRef } from 'vue'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'

/** Owns one remote selection; late replies can never replace a newer client's documents. */
export class RemoteDebugger_Module {
  public readonly clients = shallowRef<readonly BridgeDebugClient[]>([])
  public readonly selected = shallowRef<BridgeDebugClient | null>(null)
  public readonly status = shallowRef('Выберите приложение')
  private _hasSnapshot = false
  public readonly inspectionInterval = shallowRef(0)
  public readonly inspectionBusy = shallowRef(false)
  private readonly _skipData = shallowRef(true)
  public readonly skipData = readonly(this._skipData)
  private readonly _canControl = shallowRef(false)
  public readonly canControl = readonly(this._canControl)
  private _session: BridgeDebugSession | null = null
  private _generation = 0
  private _unsubscribe: (() => void) | null = null
  private _unsubscribeBridge: (() => void) | null = null

  public init(): void {
    if (this._unsubscribe) {
      return
    }
    this._unsubscribe = Endge.bridge.debug.subscribe(() => this._sync())
    this._unsubscribeBridge = Endge.bridge.subscribe(() => this._sync())
    this._sync()
  }

  public async select(client: BridgeDebugClient): Promise<void> {
    const generation = ++this._generation
    const previous = this._session
    this._session = null
    this.selected.value = client
    this._hasSnapshot = false
    this._canControl.value = false
    this.inspectionInterval.value = 0
    this.inspectionBusy.value = true
    Endge.runtime.clearInspection()
    EndgeIDE.runtimeInspection.clearSelection()
    EndgeIDE.tabs.closeAll()
    EndgeIDE.uiState.clearDebuggerState()
    Endge.domain.replaceFromPlain({})
    this.status.value = 'Ожидание подтверждения в приложении…'
    try {
      if (previous) {
        await Endge.bridge.debug.endSession(previous.sessionId).catch(() => undefined)
      }
      if (generation !== this._generation) {
        return
      }
      const session = await Endge.bridge.debug.requestSession(client)
      if (generation !== this._generation) {
        await Endge.bridge.debug.endSession(session.sessionId).catch(() => undefined)
        return
      }
      this._session = session
      this.status.value = 'Получение снимка…'
      const initial = await Endge.bridge.debug.startContextSync(session.sessionId, { includeData: !this._skipData.value })
      const snapshot = initial.snapshot
      if (generation !== this._generation || this._session !== session) {
        return
      }
      if (snapshot.format !== 'endge-diagnostics-snapshot' || snapshot.version !== 2 || !snapshot.domain) {
        throw new Error('Приложение вернуло снимок без Domain или неподдерживаемого формата')
      }
      Endge.replaceDebuggerSnapshot(snapshot)
      Endge.bridge.debug.activateContextSync(session.sessionId, initial.sequence)
      this._canControl.value = true
      this._hasSnapshot = true
      this.status.value = 'Контекст синхронизирован · управление клиентом доступно'
    }
    catch (error) {
      if (generation !== this._generation) {
        return
      }
      this._canControl.value = false
      this.status.value = error instanceof Error ? error.message : 'Не удалось подключиться'
      const session = this._session
      this._session = null
      if (session) {
        void Endge.bridge.debug.endSession(session.sessionId).catch(() => undefined)
      }
    }
    finally {
      if (generation === this._generation) {
        this.inspectionBusy.value = false
      }
    }
  }

  /** Меняет объём передачи и переснимает текущий сеанс без повторного согласия клиента. */
  public async setSkipData(value: boolean): Promise<void> {
    if (this.inspectionBusy.value || value === this._skipData.value) {
      return
    }
    this._skipData.value = value
    const session = this._session
    const generation = this._generation
    if (!session || !this._canControl.value) {
      return
    }
    this.inspectionBusy.value = true
    this._canControl.value = false
    this.inspectionInterval.value = 0
    try {
      const initial = await Endge.bridge.debug.startContextSync(session.sessionId, { includeData: !value })
      if (generation !== this._generation || this._session !== session) {
        return
      }
      Endge.runtime.clearInspection()
      Endge.replaceDebuggerSnapshot(initial.snapshot)
      Endge.bridge.debug.activateContextSync(session.sessionId, initial.sequence)
      this._canControl.value = true
    }
    catch (error) {
      if (generation !== this._generation || this._session !== session) {
        return
      }
      this.status.value = error instanceof Error ? error.message : String(error)
      this._session = null
      void Endge.bridge.debug.endSession(session.sessionId).catch(() => undefined)
    }
    finally {
      if (generation === this._generation) {
        this.inspectionBusy.value = false
      }
    }
  }

  /** Передаёт пользовательскую команду текущему клиенту; снимки и события этот метод не вызывают. */
  public async execute(command: EndgeCommand): Promise<void> {
    const session = this._session
    const generation = this._generation
    if (!session || !this._canControl.value) {
      throw new Error('Клиент ещё не подключён или синхронизация не завершена')
    }
    await Endge.bridge.debug.executeCommand(session.sessionId, command)
    if (generation !== this._generation || this._session !== session) {
      throw new Error('Сеанс клиента изменился во время выполнения команды')
    }
  }

  /** Bridge владеет частотой; этот модуль хранит только подтверждённое значение UI. */
  public async setInspectionInterval(intervalMs: number): Promise<void> {
    if (this._skipData.value) {
      return
    }
    await this._inspect(async (session) => {
      await Endge.bridge.debug.setInspectionInterval(session.sessionId, intervalMs)
      if (this._session === session) {
        this.inspectionInterval.value = intervalMs
      }
    })
  }

  public async refreshInspection(): Promise<void> {
    await this._inspect(session => Endge.bridge.debug.refreshInspection(session.sessionId))
  }

  private async _inspect(operation: (session: BridgeDebugSession) => Promise<void>): Promise<void> {
    const session = this._session
    if (!session || !this._canControl.value || this.inspectionBusy.value) {
      return
    }
    this.inspectionBusy.value = true
    try {
      await operation(session)
    }
    finally {
      if (this._session === session) {
        this.inspectionBusy.value = false
      }
    }
  }

  /** Releases selection listeners; the Core Bridge owner closes the transport. */
  public dispose(): void {
    ++this._generation
    this._canControl.value = false
    this.inspectionInterval.value = 0
    this.inspectionBusy.value = false
    this._unsubscribe?.()
    this._unsubscribeBridge?.()
    this._unsubscribe = null
    this._unsubscribeBridge = null
    this._session = null
  }

  private _sync(): void {
    this.clients.value = Endge.bridge.debug.clients
    const selected = this.selected.value
    if (selected && !this.clients.value.some(client => client.serverUrl === selected.serverUrl && client.instanceId === selected.instanceId)) {
      ++this._generation
      this._session = null
      this._canControl.value = false
      this.inspectionInterval.value = 0
      this.inspectionBusy.value = false
      this.status.value = this._hasSnapshot ? 'Приложение отключено · показан последний снимок' : 'Приложение отключено'
    }
    else if (this._session && !Endge.bridge.debug.sessions.some(session => session.sessionId === this._session?.sessionId)) {
      ++this._generation
      this._session = null
      this._canControl.value = false
      this.inspectionInterval.value = 0
      this.inspectionBusy.value = false
      this.status.value = 'Сеанс завершён · показан последний снимок'
    }
    else if (!selected) {
      const connection = Endge.bridge.connections[0]
      this.status.value = connection?.status === 'connected'
        ? 'Выберите приложение'
        : connection?.error || 'Подключение к серверу отладки…'
    }
  }
}
