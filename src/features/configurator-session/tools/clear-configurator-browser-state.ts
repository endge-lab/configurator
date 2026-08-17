/** Удаляет всё локальное состояние Configurator, доступное текущему origin. */
export function clearConfiguratorBrowserState(): void {
  if (typeof window === 'undefined') {
    return
  }

  for (const storageName of ['localStorage', 'sessionStorage'] as const) {
    try {
      window[storageName].clear()
    }
    catch {
      // Server logout остаётся главным источником истины, даже если browser storage недоступен.
    }
  }
}
