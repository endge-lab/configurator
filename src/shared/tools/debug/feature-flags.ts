const raw = import.meta.env.VITE_FEATURE_FLAGS || ''
const features = new Set(
  raw
    .split(',')
    .map(f => f.trim())
    .filter(Boolean),
)

// - debug-panel: включает панель отладки сверху
// - cancel-all-log: отключает логирование всех запросов в консоль
export type FeatureFlag = 'debug-panel' | 'cancel-all-logs'

/**
 * Проверка, включён ли флаг фичи
 * @param name Название фичи (например, 'debug-panel')
 * @returns true если фича включена
 */
export function isFeatureEnabled(name: FeatureFlag): boolean {
  return features.has(name)
}
