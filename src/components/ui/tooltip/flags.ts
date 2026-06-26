export function areTooltipsDisabled(): boolean {
  if (typeof window === 'undefined')
    return false

  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('noTooltips') === '1'
  }
  catch {
    return false
  }
}
