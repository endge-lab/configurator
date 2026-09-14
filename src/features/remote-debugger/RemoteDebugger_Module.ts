import type {
  BridgeDebugClient,
  BridgeDebugSession,
  EndgeBundle,
  EndgeBundleFileFormat,
  EndgeCommand,
  InspectionRecording,
} from '@endge/core'
import { Endge, readEndgeBundle } from '@endge/core'
import { readonly, shallowRef } from 'vue'
import { BundleFiles_Service } from '@/app/services/BundleFiles_Service'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'

/** Owns one remote selection; late replies can never replace a newer client's documents. */
export class RemoteDebugger_Module {
  public readonly playing = shallowRef(false)
  private _playTimer: ReturnType<typeof setInterval> | null = null
  public play(): void {
    if (this._playTimer) {
      this.pause()
      return
    }
    Endge.inspection.setFollowLive(false)
    this.playing.value = true
    this._playTimer = setInterval(() => {
      if (
        Endge.inspection.appliedSequence === Endge.inspection.receivedSequence
      ) {
        this.pause()
        return
      }
      try {
        Endge.inspection.stepForward()
      }
      catch (error) {
        this.pause()
        this.status.value = String(error)
      }
    }, 250)
  }

  public pause(): void {
    if (this._playTimer) {
      clearInterval(this._playTimer)
    }
    this._playTimer = null
    this.playing.value = false
  }

  public seek(sequence: number): void {
    this.pause()
    Endge.inspection.setFollowLive(false)
    Endge.inspection.seek(sequence)
  }

  public readonly clients = shallowRef<readonly BridgeDebugClient[]>([])
  public readonly selected = shallowRef<BridgeDebugClient | null>(null)
  public readonly status = shallowRef('Выберите приложение')
  public readonly source = shallowRef<'remote' | 'file' | null>(null)
  public readonly fileName = shallowRef('')
  public readonly pendingFile = shallowRef<{
    name: string
    value: EndgeBundle
  } | null>(null)

  public readonly fileError = shallowRef('')
  private readonly _fileLoading = shallowRef(false)
  public readonly fileLoading = readonly(this._fileLoading)
  public readonly connected = shallowRef(false)
  private readonly _files = new BundleFiles_Service()
  private _fileController: AbortController | null = null
  private _unsubscribeInspection: (() => void) | null = null
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
    this._unsubscribeInspection = Endge.inspection.subscribe(() => {
      this._canControl.value = Boolean(
        this._session
        && this._hasSnapshot
        && Endge.inspection.appliedSequence
        === Endge.inspection.receivedSequence
        && !Endge.inspection.error,
      )
    })
    this._sync()
  }

  public async select(client: BridgeDebugClient): Promise<void> {
    this.pause()
    const generation = ++this._generation
    const previous = this._session
    this.inspectionBusy.value = true
    this.status.value = 'Ожидание подтверждения в приложении…'
    let candidate: BridgeDebugSession | null = null
    try {
      candidate = await Endge.bridge.debug.requestSession(client)
      if (generation !== this._generation) {
        void Endge.bridge.debug
          .endSession(candidate.sessionId)
          .catch(() => undefined)
        return
      }
      this.status.value = 'Получение снимка…'
      const initial = await Endge.bridge.debug.startContextSync(
        candidate.sessionId,
        { includeData: !this._skipData.value },
      )
      if (generation !== this._generation) {
        void Endge.bridge.debug
          .endSession(candidate.sessionId)
          .catch(() => undefined)
        return
      }
      if (!initial.bundle || !initial.inspection) {
        throw new Error('Приложение не прислало программу и начальную запись')
      }
      const sequence = initial.inspection.chunks.at(-1)?.lastSequence
      if (sequence === undefined) {
        throw new Error('Приложение не прислало начальную запись')
      }
      Endge.program.prepareInstall(initial.bundle)
      Endge.inspection.prepare(initial.inspection)
      Endge.inspection.archiveCurrent()
      this._session = null
      if (previous) {
        void Endge.bridge.debug
          .endSession(previous.sessionId)
          .catch(() => undefined)
      }
      Endge.installDebuggerBundle(initial)
      this._session = candidate
      this.selected.value = client
      EndgeIDE.runtimeInspection.clearSelection()
      EndgeIDE.tabs.closeAll()
      EndgeIDE.uiState.clearDebuggerState()
      Endge.bridge.debug.activateContextSync(candidate.sessionId, sequence)
      this.source.value = 'remote'
      this.connected.value = true
      this._hasSnapshot = true
      this._canControl.value
        = Endge.inspection.appliedSequence === Endge.inspection.receivedSequence
      this.status.value = 'Приём истории активен · пошаговый просмотр'
    }
    catch (error) {
      if (candidate && candidate !== this._session) {
        void Endge.bridge.debug
          .endSession(candidate.sessionId)
          .catch(() => undefined)
      }
      if (generation === this._generation) {
        this.status.value
          = error instanceof Error ? error.message : 'Не удалось подключиться'
      }
    }
    finally {
      if (generation === this._generation) {
        this.inspectionBusy.value = false
      }
    }
  }

  /** Меняет policy отправителя, сохраняя историю и позицию просмотра. */
  public async setSkipData(value: boolean): Promise<void> {
    const session = this._session
    if (
      !session
      || this.inspectionBusy.value
      || value === this._skipData.value
    ) {
      return
    }
    this.inspectionBusy.value = true
    try {
      await Endge.bridge.debug.setInspectionData(session.sessionId, !value)
      if (this._session === session) {
        this._skipData.value = value
      }
    }
    finally {
      if (this._session === session) {
        this.inspectionBusy.value = false
      }
    }
  }

  public async prepareFile(file: File): Promise<boolean> {
    this._fileController?.abort()
    const controller = new AbortController()
    this._fileController = controller
    this._fileLoading.value = true
    this.fileError.value = ''
    this.pendingFile.value = null
    try {
      const value = await this._files.read(file, controller.signal)
      if (value.bundle && value.inspection) {
        Endge.inspection.prepare(value.inspection)
      }
      if (this._fileController === controller) {
        this.pendingFile.value = { name: file.name, value }
        return true
      }
    }
    catch (error) {
      if (!controller.signal.aborted) {
        this.fileError.value
          = error instanceof Error ? error.message : String(error)
      }
    }
    finally {
      if (this._fileController === controller) {
        this._fileLoading.value = false
      }
    }
    return false
  }

  public async openFiles(files: readonly File[]): Promise<boolean> {
    if (files.length !== 1) {
      this.cancelFile()
      this.fileError.value = 'Перетащите один файл Bundle.'
      return false
    }
    return this.openFile(files[0]!)
  }

  public async openFile(file: File): Promise<boolean> {
    if (!await this.prepareFile(file)) {
      return false
    }
    await this.installPendingFile()
    return !this.fileError.value && !this.pendingFile.value
  }

  public cancelFile(): void {
    this._fileController?.abort()
    this._fileController = null
    this._fileLoading.value = false
    this.pendingFile.value = null
    this.fileError.value = ''
  }

  public async installPendingFile(): Promise<void> {
    const pending = this.pendingFile.value
    if (!pending) {
      return
    }
    try {
      const value = readEndgeBundle(pending.value)
      if (!value.bundle) {
        Endge.installDebuggerBundle(value)
        this.pendingFile.value = null
        return
      }
      Endge.program.prepareInstall(value.bundle)
      if (value.inspection) {
        Endge.inspection.prepare(value.inspection)
      }
      Endge.inspection.archiveCurrent()
      const previous = this._session
      this.pause()
      ++this._generation
      this._session = null
      this._canControl.value = false
      this.connected.value = false
      if (previous) {
        void Endge.bridge.debug
          .endSession(previous.sessionId)
          .catch(() => undefined)
      }
      Endge.installDebuggerBundle(value)
      this.source.value = 'file'
      this.selected.value = null
      this.fileName.value = pending.name
      this._hasSnapshot = Boolean(value.inspection)
      EndgeIDE.tabs.closeAll()
      EndgeIDE.runtimeInspection.clearSelection()
      EndgeIDE.uiState.clearDebuggerState()
      this.status.value = value.inspection
        ? 'Запись загружена · пошаговый просмотр'
        : 'Структура сборки · запись runtime отсутствует'
      this.pendingFile.value = null
    }
    catch (error) {
      this.fileError.value
        = error instanceof Error ? error.message : String(error)
    }
  }

  public async downloadRecording(
    format: EndgeBundleFileFormat = 'gzip',
    range?: { from: number, to: number },
  ): Promise<void> {
    const recording = Endge.inspection.exportRecording()
    let inspection: InspectionRecording = recording
    if (range) {
      const records = recording.chunks
        .flatMap(chunk => chunk.records)
        .filter(
          record =>
            record.sequence >= range.from && record.sequence <= range.to,
        )
      if (!records.length) {
        throw new Error('Выбранный диапазон пуст')
      }
      inspection = {
        ...recording,
        chunks: records.map(record => ({
          firstSequence: record.sequence,
          lastSequence: record.sequence,
          records: [record],
        })),
      }
    }
    await this._files.download(
      {
        format: 'endge-bundle',
        version: 1,
        ...(!range
          ? { bundle: Endge.program.exportBundle({ includeAst: true }) }
          : {}),
        inspection,
      },
      format,
      range ? 'inspection-chunks' : 'inspection',
    )
  }

  public async downloadArchived(recordingId: string): Promise<void> {
    const inspection = Endge.inspection.exportArchived(recordingId)
    await this._files.download(
      {
        format: 'endge-bundle',
        version: 1,
        inspection,
        ...(inspection.programId === Endge.program.programId
          ? { bundle: Endge.program.exportBundle({ includeAst: true }) }
          : {}),
      },
      'gzip',
      'inspection-archive',
    )
  }

  public downloadArtifact(key: string): void {
    const artifact = Endge.program
      .getArtifacts()
      .find(item => `${item.ref.entityType}:${item.ref.id}` === key)
    if (artifact) {
      this._files.downloadJson(
        artifact,
        `${artifact.ref.identity}.artifact.json`,
      )
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
      await Endge.bridge.debug.setInspectionInterval(
        session.sessionId,
        intervalMs,
      )
      if (this._session === session) {
        this.inspectionInterval.value = intervalMs
      }
    })
  }

  public async refreshInspection(): Promise<void> {
    await this._inspect(session =>
      Endge.bridge.debug.refreshInspection(session.sessionId),
    )
  }

  private async _inspect(
    operation: (session: BridgeDebugSession) => Promise<void>,
  ): Promise<void> {
    const session = this._session
    if (!session || !this.connected.value || this.inspectionBusy.value) {
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
    this.pause()
    ++this._generation
    this._canControl.value = false
    this.inspectionInterval.value = 0
    this.inspectionBusy.value = false
    this.cancelFile()
    this._unsubscribeInspection?.()
    this._unsubscribeInspection = null
    this.connected.value = false
    this._unsubscribe?.()
    this._unsubscribeBridge?.()
    this._unsubscribe = null
    this._unsubscribeBridge = null
    const session = this._session
    this._session = null
    if (session) {
      void Endge.bridge.debug
        .endSession(session.sessionId)
        .catch(() => undefined)
    }
  }

  private _sync(): void {
    this.clients.value = Endge.bridge.debug.clients
    const selected = this.selected.value
    if (
      selected
      && !this.clients.value.some(
        client =>
          client.serverUrl === selected.serverUrl
          && client.instanceId === selected.instanceId,
      )
    ) {
      this.pause()
      ++this._generation
      this._session = null
      this.connected.value = false
      this._canControl.value = false
      this.inspectionInterval.value = 0
      this.inspectionBusy.value = false
      this.status.value = this._hasSnapshot
        ? 'Приложение отключено · показан последний снимок'
        : 'Приложение отключено'
    }
    else if (
      this._session
      && !Endge.bridge.debug.sessions.some(
        session => session.sessionId === this._session?.sessionId,
      )
    ) {
      this.pause()
      ++this._generation
      this._session = null
      this.connected.value = false
      this._canControl.value = false
      this.inspectionInterval.value = 0
      this.inspectionBusy.value = false
      this.status.value = 'Сеанс завершён · показан последний снимок'
    }
    else if (!selected && this.source.value !== 'file') {
      const connection = Endge.bridge.connections[0]
      this.status.value
        = connection?.status === 'connected'
          ? 'Выберите приложение'
          : connection?.error || 'Подключение к серверу отладки…'
    }
  }
}
