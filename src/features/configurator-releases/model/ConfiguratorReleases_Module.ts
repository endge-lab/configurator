import type {
  ConfiguratorCommit,
  ConfiguratorCommitPlan,
  ConfiguratorRelease,
  ConfiguratorRestorePlan,
} from '@/features/configurator-releases/domain/types/configurator-release.type'
import type { ConfiguratorReleases_Service } from '@/features/configurator-releases/model/ConfiguratorReleases_Service'

export class ConfiguratorReleases_Module {
  public releases: ConfiguratorRelease[] = []
  public commits: ConfiguratorCommit[] = []
  public commitPlan: ConfiguratorCommitPlan | null = null
  public loading = false
  public error: string | null = null
  private readonly _listeners = new Set<() => void>()

  public constructor(private readonly _service: ConfiguratorReleases_Service) {}

  public subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  public async load(): Promise<void> {
    await this._run(() => this._refresh())
  }

  public async createCommit(message: string): Promise<ConfiguratorCommit> {
    return this._run(async () => {
      const plan = this.commitPlan ?? (await this._service.planCommit())
      const commit = await this._service.createCommit(
        message,
        plan.headSequence,
      )
      await this._refresh()
      return commit
    })
  }

  public getCommitDiff(id: string): Promise<ConfiguratorCommit> {
    return this._run(() => this._service.getCommitDiff(id))
  }

  public async createRelease(
    identity: string,
    sourceCommitId: string,
  ): Promise<ConfiguratorRelease> {
    return this._run(async () => {
      const release = await this._service.createRelease(
        identity,
        sourceCommitId,
      )
      await this._refresh()
      return release
    })
  }

  public planCommitRestore(id: string): Promise<ConfiguratorRestorePlan> {
    return this._run(() => this._service.planCommitRestore(id))
  }

  public restoreCommit(
    id: string,
    expectedHeadSequence: number,
  ): Promise<ConfiguratorCommit> {
    return this._run(() =>
      this._service.restoreCommit(id, expectedHeadSequence),
    )
  }

  public planReleaseRestore(
    identity: string,
  ): Promise<ConfiguratorRestorePlan> {
    return this._run(() => this._service.planReleaseRestore(identity))
  }

  public restoreRelease(
    identity: string,
    expectedHeadSequence: number,
  ): Promise<ConfiguratorCommit> {
    return this._run(() =>
      this._service.restoreRelease(identity, expectedHeadSequence),
    )
  }

  public download(identity: string): Promise<void> {
    return this._service.download(identity)
  }

  private async _refresh(): Promise<void> {
    const [releases, commits, commitPlan] = await Promise.all([
      this._service.listReleases(),
      this._service.listCommits(),
      this._service.planCommit(),
    ])
    this.releases = releases
    this.commits = commits
    this.commitPlan = commitPlan
  }

  private async _run<T>(operation: () => Promise<T>): Promise<T> {
    this.loading = true
    this.error = null
    this._notify()
    try {
      return await operation()
    }
    catch (error) {
      this.error
        = error instanceof Error ? error.message : 'Version operation failed'
      throw error
    }
    finally {
      this.loading = false
      this._notify()
    }
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      listener()
    }
  }
}
