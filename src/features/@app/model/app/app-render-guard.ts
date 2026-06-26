import { shallowRef } from 'vue'

export interface AppRenderGuardState {
  error: Error
  errorInfo: string
  componentName: string
  routePath: string
  reason: 'recursive-updates' | 'error-storm'
  hits: number
  triggeredAt: string
}

const ERROR_WINDOW_MS = 2000
const ERROR_STORM_LIMIT = 8

const recentErrorTimestamps: number[] = []

export const appRenderGuardState = shallowRef<AppRenderGuardState | null>(null)

function normalizeError(err: unknown): Error {
  if (err instanceof Error)
    return err
  if (typeof err === 'string')
    return new Error(err)

  try {
    return new Error(JSON.stringify(err))
  }
  catch {
    return new Error(String(err))
  }
}

function trimOldErrorTimestamps(now: number): void {
  while (recentErrorTimestamps.length > 0 && now - recentErrorTimestamps[0]! > ERROR_WINDOW_MS)
    recentErrorTimestamps.shift()
}

function recordRecentError(now: number): number {
  trimOldErrorTimestamps(now)
  recentErrorTimestamps.push(now)
  return recentErrorTimestamps.length
}

function looksLikeRecursiveVueUpdate(error: Error, errorInfo: string): boolean {
  const message = `${error.message}\n${error.stack ?? ''}`.toLowerCase()
  const info = errorInfo.toLowerCase()

  return message.includes('maximum recursive updates exceeded')
    || info.includes('#runtime-14')
    || info.includes('#runtime-15')
    || info.includes('scheduler flush')
    || info.includes('component update')
}

function clearAdminPersistedState(): void {
  if (typeof window === 'undefined')
    return

  try {
    localStorage.removeItem('endge-editor-tabs')
    localStorage.removeItem('app:grid-layout-state')
  }
  catch {
    // ignore storage failures
  }
}

function shutdownAdminRuntime(): void {
  void import('@/features/endge-admin/model/core/endge-admin.ts')
    .then(({ EndgeAdmin }) => {
      try {
        EndgeAdmin.reset()
      }
      catch {
        // ignore emergency reset failures
      }
    })
    .catch(() => {
      // ignore lazy import failures
    })
}

export function resetAppRenderGuard(): void {
  recentErrorTimestamps.length = 0
  appRenderGuardState.value = null
}

export function captureAppRenderFailure(params: {
  err: unknown
  errorInfo?: string
  componentName?: string
  routePath?: string
}): AppRenderGuardState | null {
  if (appRenderGuardState.value)
    return appRenderGuardState.value

  const now = Date.now()
  const hits = recordRecentError(now)
  const error = normalizeError(params.err)
  const errorInfo = String(params.errorInfo ?? '')
  const componentName = String(params.componentName ?? 'Unknown')
  const routePath = String(params.routePath ?? '')

  const isRecursive = looksLikeRecursiveVueUpdate(error, errorInfo)
  const isErrorStorm = hits >= ERROR_STORM_LIMIT

  if (!isRecursive && !isErrorStorm)
    return null

  if (routePath.startsWith('/admin')) {
    clearAdminPersistedState()
    shutdownAdminRuntime()
  }

  appRenderGuardState.value = {
    error,
    errorInfo,
    componentName,
    routePath,
    reason: isRecursive ? 'recursive-updates' : 'error-storm',
    hits,
    triggeredAt: new Date(now).toISOString(),
  }

  console.error('[AppRenderGuard] Emergency UI shutdown triggered', {
    routePath,
    componentName,
    errorInfo,
    reason: appRenderGuardState.value.reason,
    hits,
    error,
  })

  return appRenderGuardState.value
}

export function triggerAppRenderGuardTest(params: {
  routePath?: string
  componentName?: string
} = {}): AppRenderGuardState | null {
  return captureAppRenderFailure({
    err: new Error('Maximum recursive updates exceeded [guard-test]'),
    errorInfo: 'https://vuejs.org/error-reference/#runtime-15',
    componentName: params.componentName ?? 'GuardTest',
    routePath: params.routePath ?? '',
  })
}
