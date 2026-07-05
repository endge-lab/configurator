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

export function isIDEWidgetsDisabled(): boolean {
  return hasFlag('noWidgets')
}

export function isIDERuntimeDebuggerDisabled(): boolean {
  return hasFlag('noRuntimeDebugger')
}

export function isIDEPlainMode(): boolean {
  return hasFlag('plainIDE') || hasFlag('plainAdmin')
}

export function isIDETabStorageDisabled(): boolean {
  return hasFlag('noTabStorage')
}
