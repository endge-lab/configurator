function hasFlag(name: string): boolean {
  if (typeof window === 'undefined')
    return false

  try {
    const params = new URLSearchParams(window.location.search)
    return params.get(name) === '1'
  }
  catch {
    return false
  }
}

export function isAdminWidgetsDisabled(): boolean {
  return hasFlag('noWidgets')
}

export function isAdminRuntimeDebuggerDisabled(): boolean {
  return hasFlag('noRuntimeDebugger')
}

export function isAdminPlainMode(): boolean {
  return hasFlag('plainAdmin')
}

export function isAdminTabStorageDisabled(): boolean {
  return hasFlag('noTabStorage')
}
