import type { ConfiguratorRelease } from '@/features/configurator-releases/domain/types/configurator-release.type'
import type { ConfiguratorReleases_Service } from '@/features/configurator-releases/model/ConfiguratorReleases_Service'

export class ConfiguratorReleases_Module {
  public items: ConfiguratorRelease[] = []
  public loading = false
  public error: string | null = null
  private readonly _listeners = new Set<() => void>()

  public constructor(private readonly _service: ConfiguratorReleases_Service) {}

  public subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  public async load(): Promise<void> {
    await this._run(async () => { this.items = await this._service.list() })
  }

  public async create(identity: string): Promise<void> {
    await this._run(async () => {
      await this._service.create(identity)
      this.items = await this._service.list()
    })
  }

  public download(identity: string): Promise<void> {
    return this._service.download(identity)
  }

  private async _run(operation: () => Promise<void>): Promise<void> {
    this.loading = true
    this.error = null
    this._notify()
    try { await operation() }
    catch (error) {
      this.error = error instanceof Error ? error.message : 'Release operation failed'
      throw error
    }
    finally {
      this.loading = false
      this._notify()
    }
  }

  private _notify(): void {
    for (const listener of this._listeners) listener()
  }
}
