export function readApplicationLoaderMinimumDuration(env: ImportMetaEnv): number | undefined {
  const rawDuration = env.VITE_CONFIGURATOR_LOADER_MIN_DURATION_MS?.trim()
  if (!rawDuration) {
    return undefined
  }

  const duration = Number(rawDuration)
  if (duration === 0) {
    return undefined
  }
  if (!Number.isInteger(duration) || duration < 0) {
    console.warn('[ApplicationLoader] VITE_CONFIGURATOR_LOADER_MIN_DURATION_MS must be a non-negative integer; loader is disabled.')
    return undefined
  }

  return duration
}
