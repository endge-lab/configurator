import type { ConfiguratorDiagnostics_Module } from '@/app/model/modules/diagnostics/ConfiguratorDiagnostics_Module'
import type { App, ComponentPublicInstance } from 'vue'
import type { Router } from 'vue-router'

/** Connects Vue and browser error boundaries to Configurator diagnostics. */
export class VueErrorBoundary_Adapter {
  private _installed = false
  private _previousVueErrorHandler: App['config']['errorHandler'] = undefined

  public constructor(
    private readonly _app: App,
    private readonly _router: Router,
    private readonly _diagnostics: ConfiguratorDiagnostics_Module,
  ) {}

  public setup(): void {
    if (this._installed) {
      return
    }

    this._previousVueErrorHandler = this._app.config.errorHandler
    this._app.config.errorHandler = this._handleVueError
    window.addEventListener('error', this._handleWindowError)
    window.addEventListener('unhandledrejection', this._handleUnhandledRejection)
    this._installed = true
  }

  public destroy(): void {
    if (!this._installed) {
      return
    }

    this._app.config.errorHandler = this._previousVueErrorHandler
    window.removeEventListener('error', this._handleWindowError)
    window.removeEventListener('unhandledrejection', this._handleUnhandledRejection)
    this._installed = false
  }

  private readonly _handleVueError: NonNullable<App['config']['errorHandler']> = (err, instance, info) => {
    this._diagnostics.capture({
      err,
      errorInfo: String(info ?? ''),
      componentName: this._resolveComponentName(instance),
      routePath: this._router.currentRoute.value.path,
      isEndgeIDE: this._router.currentRoute.value.meta.layoutScope === 'endge-ide',
    })

    console.error('[Vue errorHandler]', err, info, instance)
  }

  private readonly _handleWindowError = (event: ErrorEvent): void => {
    if (this._isIgnorableBrowserError(event.message) || this._isIgnorableBrowserError(event.error?.message)) {
      event.preventDefault()
      return
    }

    this._diagnostics.capture({
      err: event.error ?? new Error(event.message),
      errorInfo: 'window.error',
      componentName: 'Window',
      routePath: this._router.currentRoute.value.path,
      isEndgeIDE: this._router.currentRoute.value.meta.layoutScope === 'endge-ide',
    })
  }

  private readonly _handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const reasonMessage = event.reason instanceof Error ? event.reason.message : event.reason
    if (this._isIgnorableBrowserError(reasonMessage)) {
      event.preventDefault()
      return
    }

    this._diagnostics.capture({
      err: event.reason,
      errorInfo: 'window.unhandledrejection',
      componentName: 'Promise',
      routePath: this._router.currentRoute.value.path,
      isEndgeIDE: this._router.currentRoute.value.meta.layoutScope === 'endge-ide',
    })
  }

  private _isIgnorableBrowserError(raw: unknown): boolean {
    const message = String(raw ?? '').trim().toLowerCase()
    return message === 'resizeobserver loop completed with undelivered notifications.'
      || message === 'resizeobserver loop limit exceeded'
  }

  private _resolveComponentName(instance: ComponentPublicInstance | null): string {
    let current = instance
    while (current) {
      const name = current.$options?.name || current.$options?.__name
      if (name && !name.startsWith('_') && name !== 'RouterView') {
        return name
      }
      current = current.$parent
    }
    return 'Unknown'
  }
}
