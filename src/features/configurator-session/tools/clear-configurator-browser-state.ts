const configuratorPrefixes = [
  'endge:configurator:',
  'endge:configurator-login-redirect:',
  'endge:runtime-preview:',
  'endge-ide:',
  'endge-editor-',
  'endge-admin-ui-editor-',
  'configurator.',
]
const configuratorKeys = new Set(['app:grid-layout-state', 'app:date-format'])
// Базы IndexedDB Configurator: локальные кэши данных заказчика (например, схемы GraphQL).
const configuratorDatabases = ['endge-ide-graphql-schemas']

// Удаляет только browser state Configurator на общем с AODB origin.
export function clearConfiguratorBrowserState(): void {
  if (typeof window === 'undefined') {
    return
  }

  for (const storageName of ['localStorage', 'sessionStorage'] as const) {
    try {
      const storage = window[storageName]
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
      for (const key of keys) {
        if (key && (configuratorKeys.has(key) || configuratorPrefixes.some(prefix => key.startsWith(prefix)))) {
          storage.removeItem(key)
        }
      }
    }
    catch {
      // Server logout остаётся главным источником истины, даже если browser storage недоступен.
    }
  }

  try {
    const factory = window.indexedDB
    for (const name of configuratorDatabases) {
      // Удаление ставится в очередь: открытые соединения закрываются по versionchange.
      factory?.deleteDatabase(name)
    }
  }
  catch {
    // Недоступный IndexedDB (приватный режим) не мешает выходу.
  }
}
