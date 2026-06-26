type FrameColor = 'info' | 'success' | 'warn' | 'error'

interface FrameTimeLimits {
  error: number
  warn: number
}

interface PhaseLog {
  type: 'info' | 'warn' | 'error' | 'success'
  message: unknown
}

interface FrameContext {
  title: string
  startTime: number
  phases: Array<[string, number]>
  phaseLogs: Record<string, Array<PhaseLog>>
  logs: Array<PhaseLog>
  forceColorOrLimits?: FrameColor | FrameTimeLimits
}

export class HubDebug {
  private _enabled = true
  private readonly _timers = new Map<string, number>()
  private readonly _stack: Array<FrameContext> = []
  private _phaseStart = 0
  private _phaseName = ''
  private readonly _completedFrames: Array<FrameContext> = []

  public set enabled(v: boolean) {
    this._enabled = v
  }

  public get enabled(): boolean {
    return this._enabled
  }

  //
  // FRAME
  //

  public frameStart(group: string | null = null): void {
    const ctx: FrameContext = {
      title: group ?? '🔹FRAME',
      startTime: performance.now(),
      phases: [],
      phaseLogs: {},
      logs: [],
    }
    this._stack.push(ctx)
  }

  public frameEnd(title?: string, forceColorOrLimits?: FrameColor | FrameTimeLimits): void {
    const ctx = this._stack.pop()
    if (!ctx) return

    if (title) {
      ctx.title = title
    }
    if (forceColorOrLimits) {
      ctx.forceColorOrLimits = forceColorOrLimits
    }

    // Добавляем в FIFO очередь завершённых фреймов
    this._completedFrames.push(ctx)

    // Если стек пуст, значит закончился верхнеуровневый фрейм
    if (this._stack.length === 0) {
      this._dumpFrames()
    }
  }

  public frame(
    title = '🔹FRAME',
    callback: () => void | Promise<void>,
    forceColorOrLimits?: FrameColor | FrameTimeLimits,
  ): Promise<void> | void {
    this.frameStart(title)
    const result = callback()
    if (result instanceof Promise) {
      return result.finally(() => this.frameEnd(title, forceColorOrLimits))
    } else {
      this.frameEnd(title, forceColorOrLimits)
    }
  }

  //
  // PHASE
  //

  public phaseStart(name: string): void {
    this._phaseName = name
    this._phaseStart = performance.now()
  }

  public phaseEnd(): void {
    const ctx = this._currentCtx()
    if (!ctx || !this._phaseName) return
    const dur = performance.now() - this._phaseStart
    ctx.phases.push([this._phaseName, dur])
    this._phaseName = ''
  }

  public phase(name: string, callback: () => void | Promise<void>): Promise<void> | void {
    this.phaseStart(name)
    const result = callback()
    if (result instanceof Promise) {
      return result.finally(() => this.phaseEnd())
    } else {
      this.phaseEnd()
    }
  }

  //
  // LOGGING
  //

  public info(message: unknown, timerLabel?: string): void {
    this._log('info', message, timerLabel)
  }

  public warn(message: unknown, timerLabel?: string): void {
    this._log('warn', message, timerLabel)
  }

  public error(message: unknown, timerLabel?: string): void {
    this._log('error', message, timerLabel)
  }

  public success(message: unknown, timerLabel?: string): void {
    this._log('success', message, timerLabel)
  }

  //
  // TIMERS
  //

  public startTimer(label: string): void {
    this._timers.set(label, performance.now())
  }

  //
  // INTERNAL
  //

  private _currentCtx(): FrameContext | undefined {
    return this._stack.at(-1)
  }

  private _log(type: PhaseLog['type'], message: unknown, timerLabel?: string): void {
    if (!this._enabled) return

    const ctx = this._currentCtx()
    if (!ctx) return

    let finalMessage = message

    if (timerLabel && this._timers.has(timerLabel)) {
      const started = this._timers.get(timerLabel)!
      const elapsed = performance.now() - started
      this._timers.delete(timerLabel)

      if (typeof message === 'string') {
        finalMessage = `${message} (${elapsed.toFixed(2)}ms)`
      } else if (Array.isArray(message)) {
        finalMessage = [...message, `(${elapsed.toFixed(2)}ms)`]
      } else {
        finalMessage = [message, `(${elapsed.toFixed(2)}ms)`]
      }
    }

    if (this._phaseName) {
      if (!ctx.phaseLogs[this._phaseName]) {
        ctx.phaseLogs[this._phaseName] = []
      }
      ctx.phaseLogs[this._phaseName].push({ type, message: finalMessage })
    } else {
      ctx.logs.push({ type, message: finalMessage })
    }
  }

  private _dumpFrames(): void {
    for (let i = 0; i < this._completedFrames.length; i++) {
      const ctx = this._completedFrames[i]

      const frameTime = performance.now() - ctx.startTime

      // Выбираем цвет
      let style = ''
      if (typeof ctx.forceColorOrLimits === 'string') {
        style = this._styleForColor(ctx.forceColorOrLimits)
      } else if (ctx.forceColorOrLimits) {
        if (frameTime >= ctx.forceColorOrLimits.error) {
          style = this._styleForColor('error')
        } else if (frameTime >= ctx.forceColorOrLimits.warn) {
          style = this._styleForColor('warn')
        } else {
          style = this._styleForColor('success')
        }
      } else if (ctx.logs.some(l => l.type === 'error')) {
        style = this._styleForColor('error')
      } else if (ctx.logs.some(l => l.type === 'warn')) {
        style = this._styleForColor('warn')
      } else {
        style = this._styleForColor('success')
      }

      const label = `${ctx.title} [${frameTime.toFixed(2)}ms]`
      console.groupCollapsed(`%c${label}`, style)

      // Вывод фаз
      for (const [name, ms] of ctx.phases) {
        console.groupCollapsed(`%c[${name}] ${ms.toFixed(2)}ms`, 'color:#0ff;')
        const logs = ctx.phaseLogs[name] || []
        for (const log of logs) {
          this._printColored(log.type, log.message)
        }
        console.groupEnd()
      }

      // Вывод обычных логов
      for (const log of ctx.logs) {
        this._printColored(log.type, log.message)
      }

      console.groupEnd()
    }

    // После вывода очищаем очередь
    this._completedFrames.length = 0
  }

  private _styleForColor(color: FrameColor): string {
    switch (color) {
      case 'error':
        return 'color:#f00;font-weight:bold;'
      case 'warn':
        return 'color:#f90;font-weight:bold;'
      case 'info':
        return 'color:#09f;font-weight:bold;'
      default:
        return 'color:#0c0;font-weight:bold;'
    }
  }

  private _printColored(type: PhaseLog['type'], message: unknown): void {
    const colors = {
      info: 'color:#888',
      warn: 'color:#f90;font-weight:bold;',
      error: 'color:#f00;font-weight:bold;',
      success: 'color:#0c0;font-weight:bold;',
    } as const

    if (typeof message === 'string') {
      console.log(`%c${message}`, colors[type])
    } else {
      console.log('%c', colors[type], message)
    }
  }
}
