export function monitorTimers() {
  const originalSetTimeout = window.setTimeout
  const originalClearTimeout = window.clearTimeout
  const originalSetInterval = window.setInterval
  const originalClearInterval = window.clearInterval

  const activeTimeouts = new Set<number>()
  const activeIntervals = new Set<number>()

  window.setTimeout = function (fn, delay, ...args) {
    const id = originalSetTimeout(fn, delay, ...args)
    activeTimeouts.add(id)
    return id
  }

  window.clearTimeout = function (id) {
    activeTimeouts.delete(id)
    return originalClearTimeout(id)
  }

  window.setInterval = function (fn, delay, ...args) {
    const id = originalSetInterval(fn, delay, ...args)
    activeIntervals.add(id)
    return id
  }

  window.clearInterval = function (id) {
    activeIntervals.delete(id)
    return originalClearInterval(id)
  }

  return {
    count() {
      return {
        timeouts: activeTimeouts.size,
        intervals: activeIntervals.size,
        total: activeTimeouts.size + activeIntervals.size,
      }
    },
    log() {
      const c = this.count()
      console.log(`[Timers] timeouts: ${c.timeouts}, intervals: ${c.intervals}, total: ${c.total}`)
    },
    clearAll() {
      for (const id of activeTimeouts) clearTimeout(id)
      for (const id of activeIntervals) clearInterval(id)
      activeTimeouts.clear()
      activeIntervals.clear()
    },
  }
}
