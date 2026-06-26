type PhaseLog = { type: 'info' | 'warn' | 'error' | 'success'; message: string }
type TimerMap = Map<string, number>

export class NovaDebug {
  private _enabled = false
  private _lastLogFrameTimes = new Map<string, number>()
  private readonly _logThrottleTime = 1000
  private _shouldLogFrame = false
  private _frameStartTime = 0
  private _phaseStart = 0
  private _phaseName = ''
  private _phaseStack = 0

  private _framePhases: [string, number][] = []
  private _frameLogs: string[] = []
  private _phaseLogs: Record<string, PhaseLog[]> = {}
  private _timers: TimerMap = new Map()

  set enabled(v: boolean) {
    this._enabled = v
  }

  get enabled(): boolean {
    return this._enabled
  }

  //
  // FRAME
  //

  frameStart(group: string | null = 'default'): void {
    if (this._phaseStack === 0) {
      const now = performance.now()
      this._frameStartTime = now
      this._framePhases = []
      this._frameLogs = []
      this._phaseLogs = {}
      this._timers.clear()

      if (group === null) {
        this._shouldLogFrame = true
      } else {
        const groupKey = group || 'default'
        const lastTime = this._lastLogFrameTimes.get(groupKey) ?? 0
        this._shouldLogFrame =
          now - lastTime >= this._logThrottleTime || lastTime === 0

        if (this._shouldLogFrame) {
          this._lastLogFrameTimes.set(groupKey, now)
        }
      }
    }

    this._phaseStack++
  }

  frameEnd(title = '🔹FRAME'): void {
    this._phaseStack--
    if (!this._enabled || !this._shouldLogFrame || this._phaseStack !== 0)
      return

    const frameTime = performance.now() - this._frameStartTime
    const fps = 1000 / frameTime

    let style = ''
    if (fps < 30)
      style = 'color:#f00;font-weight:bold;' // красный
    else if (fps < 60)
      style = 'color:#f90;font-weight:bold;' // оранжевый
    else style = 'color:#0c0;font-weight:bold;' // зелёный

    const empty = this._framePhases.length === 0 && this._frameLogs.length === 0
    const label = empty
      ? `${title} [${frameTime.toFixed(2)}ms / ${fps.toFixed(0)}ups] (empty)`
      : `${title} [${frameTime.toFixed(2)}ms / ${fps.toFixed(0)}ups]`

    console.groupCollapsed(`%c${label}`, style)

    for (const [name, ms] of this._framePhases) {
      console.groupCollapsed(`%c[${name}] ${ms.toFixed(2)}ms`, 'color:#0ff;')
      const logs = this._phaseLogs[name] || []
      for (const log of logs) {
        this.printColored(log.type, log.message)
      }
      console.groupEnd()
    }

    for (const log of this._frameLogs) {
      this.printColored('info', log)
    }

    console.groupEnd()
  }

  //
  // PHASE
  //

  phaseStart(name: string): void {
    if (!this._shouldLogFrame || !this._enabled) return
    this._phaseName = name
    this._phaseStart = performance.now()
  }

  phaseEnd(): void {
    if (!this._shouldLogFrame || !this._enabled) return
    const duration = performance.now() - this._phaseStart
    this._framePhases.push([this._phaseName, duration])
  }

  //
  // FACE LOG
  //

  faceLog(message: string): void {
    if (!this._enabled || !this._shouldLogFrame) return
    this._frameLogs.push(message)
  }

  //
  // TIMERS
  //

  startTimer(label: string): void {
    if (!this._enabled || !this._shouldLogFrame) return
    this._timers.set(label, performance.now())
  }

  //
  // LOGS
  //

  info(message: string, timerLabel?: string): void {
    this.logToPhase('info', message, timerLabel)
  }

  warn(message: string, timerLabel?: string): void {
    this.logToPhase('warn', message, timerLabel)
  }

  error(message: string, timerLabel?: string): void {
    this.logToPhase('error', message, timerLabel)
  }

  success(message: string, timerLabel?: string): void {
    this.logToPhase('success', message, timerLabel)
  }

  private logToPhase(
    type: PhaseLog['type'],
    message: string,
    timerLabel?: string,
  ): void {
    if (!this._enabled || !this._shouldLogFrame) return

    if (timerLabel && this._timers.has(timerLabel)) {
      const started = this._timers.get(timerLabel)!
      const elapsed = performance.now() - started
      message += ` (${elapsed.toFixed(2)}ms)`
      this._timers.delete(timerLabel)
    }

    if (!this._phaseLogs[this._phaseName]) {
      this._phaseLogs[this._phaseName] = []
    }
    this._phaseLogs[this._phaseName].push({ type, message })
  }

  private printColored(type: PhaseLog['type'], message: string): void {
    const colors = {
      info: 'color:#888',
      warn: 'color:#f90;font-weight:bold;',
      error: 'color:#f00;font-weight:bold;',
      success: 'color:#0c0;font-weight:bold;',
    } as const

    console.log(`%c${message}`, colors[type])
  }
}
