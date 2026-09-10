import type { BridgeDebugClient, BridgeDebugSession, DiagnosticsSnapshot, EndgeContextSnapshot } from '@endge/core'
import { Endge } from '@endge/core'
import { shallowRef } from 'vue'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import { readSnapshotContext } from '@/features/remote-debugger/tools/snapshot-context'

/** Owns one remote selection; late replies can never replace a newer client's documents. */
export class RemoteDebugger_Module {
  public readonly clients = shallowRef<readonly BridgeDebugClient[]>([])
  public readonly selected = shallowRef<BridgeDebugClient | null>(null)
  public readonly status = shallowRef('Выберите приложение')
  public readonly snapshot = shallowRef<DiagnosticsSnapshot | null>(null)
  public readonly context = shallowRef<Readonly<Partial<EndgeContextSnapshot>>>({})
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
    this.snapshot.value = null
    this.context.value = {}
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
      const snapshot = await Endge.bridge.debug.getSnapshot(session.sessionId)
      if (generation !== this._generation || this._session !== session) {
        return
      }
      if (snapshot.format !== 'endge-diagnostics-snapshot' || snapshot.version !== 2 || !snapshot.domain) {
        throw new Error('Приложение вернуло снимок без Domain или неподдерживаемого формата')
      }
      const context = readSnapshotContext(snapshot)
      Endge.replaceDebuggerSnapshot(snapshot)
      this.context.value = context
      this.snapshot.value = snapshot
      this.status.value = 'Снимок приложения · только чтение'
    }
    catch (error) {
      if (generation !== this._generation) {
        return
      }
      this.status.value = error instanceof Error ? error.message : 'Не удалось подключиться'
      const session = this._session
      this._session = null
      if (session) {
        void Endge.bridge.debug.endSession(session.sessionId).catch(() => undefined)
      }
    }
  }

  /** Releases selection listeners; the Core Bridge owner closes the transport. */
  public dispose(): void {
    ++this._generation
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
      this.status.value = this.snapshot.value ? 'Приложение отключено · показан последний снимок' : 'Приложение отключено'
    }
    else if (this._session && !Endge.bridge.debug.sessions.some(session => session.sessionId === this._session?.sessionId)) {
      ++this._generation
      this._session = null
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
