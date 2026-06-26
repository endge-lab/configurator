import { EndgeModule } from '@endge/core'

export class AppDomain extends EndgeModule {
  public reset(): void {
    this.notify()
  }

  public serialize(): Record<string, never> {
    return {}
  }

  public deserialize(): void {
    this.notify()
  }
}
