import { createApp } from 'vue'

interface ApplicationLoaderOptions {
  minimumDuration: number
  statusLabel: string
  versionLabel: string
}

export interface ApplicationLoaderHandle {
  minimumDurationElapsed: Promise<void>
  unmount: () => void
}

export async function startApplicationLoader(options: ApplicationLoaderOptions): Promise<ApplicationLoaderHandle | undefined> {
  try {
    const { default: ApplicationLoader } = await import('../ui/ApplicationLoader.vue')
    const loaderApp = createApp(ApplicationLoader, {
      statusLabel: options.statusLabel,
      versionLabel: options.versionLabel,
    })
    loaderApp.mount('#app')

    let active = true
    let resolveMinimumDuration: () => void = () => undefined
    const minimumDurationElapsed = new Promise<void>((resolve) => {
      resolveMinimumDuration = resolve
    })
    const minimumDurationTimeout = window.setTimeout(resolveMinimumDuration, options.minimumDuration)

    return {
      minimumDurationElapsed,
      unmount: () => {
        if (!active) {
          return
        }
        active = false
        window.clearTimeout(minimumDurationTimeout)
        resolveMinimumDuration()
        loaderApp.unmount()
      },
    }
  }
  catch (error: unknown) {
    console.warn(`[ApplicationLoader] Failed to mount: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}
