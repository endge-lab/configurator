import type { ConfiguratorReleasesHttp_Adapter } from '@/features/configurator-releases/adapters/ConfiguratorReleasesHttp_Adapter'
import type {
  ConfiguratorCommit,
  ConfiguratorCommitPlan,
  ConfiguratorRelease,
  ConfiguratorRestorePlan,
} from '@/features/configurator-releases/domain/types/configurator-release.type'

export class ConfiguratorReleases_Module {
  /** Изменяемое состояние истории версий принадлежит только модулю. */
  private _releases: ConfiguratorRelease[] = []
  private _commits: ConfiguratorCommit[] = []
  private _commitPlan: ConfiguratorCommitPlan | null = null
  private _loading = false
  private _error: string | null = null
  private readonly _listeners = new Set<() => void>()

  public constructor(private readonly _service: ConfiguratorReleasesHttp_Adapter) {}

  public subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  public async load(): Promise<void> {
    await this._run(() => this._refresh())
  }

  public async createCommit(message: string): Promise<ConfiguratorCommit> {
    return this._run(async () => {
      const plan = this._commitPlan ?? (await this._service.planCommit())
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
    this._releases = releases
    this._commits = commits
    this._commitPlan = commitPlan
  }

  private async _run<T>(operation: () => Promise<T>): Promise<T> {
    this._loading = true
    this._error = null
    this._notify()
    try {
      return await operation()
    }
    catch (error) {
      this._error
        = error instanceof Error ? error.message : 'Не удалось выполнить операцию с версиями'
      throw error
    }
    finally {
      this._loading = false
      this._notify()
    }
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      listener()
    }
  }

  /** Возвращает только доступную для чтения историю релизов. */
  public get releases(): readonly ConfiguratorRelease[] {
    return this._releases
  }

  /** Возвращает только доступную для чтения историю коммитов. */
  public get commits(): readonly ConfiguratorCommit[] {
    return this._commits
  }

  /** Возвращает актуальный план следующего коммита. */
  public get commitPlan(): ConfiguratorCommitPlan | null {
    return this._commitPlan
  }

  /** Показывает выполнение текущей операции с версиями. */
  public get loading(): boolean {
    return this._loading
  }

  /** Возвращает последнюю ошибку операции с версиями. */
  public get error(): string | null {
    return this._error
  }
}
