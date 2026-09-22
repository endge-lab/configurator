import { computed, shallowRef } from 'vue'

/** Владеет общим состоянием активности параллельных изменений IDE. */
export class EndgeIDEBusy_Module {
  private readonly _pending = shallowRef(0)
  private readonly _busy = computed(() => this._pending.value > 0)

  public get value(): boolean {
    return this._busy.value
  }

  public get state() {
    return this._busy
  }

  public async run<T>(operation: Promise<T>): Promise<T> {
    this._pending.value += 1
    try {
      return await operation
    }
    finally {
      this._pending.value = Math.max(0, this._pending.value - 1)
    }
  }

  public reset(): void {
    this._pending.value = 0
  }
}
