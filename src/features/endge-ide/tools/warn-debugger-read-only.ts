import { Endge, EndgeDebuggerReadOnlyError } from '@endge/core'
import { toast } from 'vue-sonner'

/** Expected write rejection stays a warning and never becomes a fatal render error. */
export function warnDebuggerReadOnly(error: unknown): boolean {
  if (!(error instanceof EndgeDebuggerReadOnlyError)) {
    return false
  }
  toast.warning(error.message, { id: 'debugger-read-only' })
  return true
}

/** Shared warning for native editor read-only events that do not throw themselves. */
export function warnDebuggerEditAttempt(): void {
  if (Endge.mode === 'debugger') {
    warnDebuggerReadOnly(new EndgeDebuggerReadOnlyError())
  }
}
