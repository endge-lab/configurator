import type { EndgeBundle, EndgeBundleFileFormat } from '@endge/core'

/** Browser file boundary shared by build export and debugger import; caller owns cancellation. */
export class BundleFiles_Service {
  public async read(file: File, signal?: AbortSignal): Promise<EndgeBundle> {
    if (file.size > 256 * 1024 * 1024) {
      throw new Error('Файл превышает лимит 256 MiB')
    }
    signal?.throwIfAborted()
    const bytes = new Uint8Array(await file.arrayBuffer())
    return this._convert(
      { operation: 'decode', bytes },
      signal,
    ) as Promise<EndgeBundle>
  }

  public encode(value: EndgeBundle, format: EndgeBundleFileFormat, signal?: AbortSignal): Promise<Uint8Array> {
    return this._convert({ operation: 'encode', value, format }, signal) as Promise<Uint8Array>
  }

  public downloadBytes(bytes: Uint8Array, format: EndgeBundleFileFormat, name: string): void {
    this._downloadJsonOrBytes(bytes, `${name}.endge-bundle.${format === 'gzip' ? 'gz' : 'json'}`, format === 'gzip' ? 'application/gzip' : 'application/json')
  }

  public async download(
    value: EndgeBundle,
    format: EndgeBundleFileFormat,
    name: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const bytes = (await this._convert(
      { operation: 'encode', value, format },
      signal,
    )) as Uint8Array
    signal?.throwIfAborted()
    this._downloadJsonOrBytes(
      bytes,
      `${name}.endge-bundle.${format === 'gzip' ? 'gz' : 'json'}`,
      format === 'gzip' ? 'application/gzip' : 'application/json',
    )
  }

  public downloadJson(value: unknown, name: string): void {
    this._downloadJsonOrBytes(
      new TextEncoder().encode(JSON.stringify(value, null, 2)),
      name,
      'application/json',
    )
  }

  private _downloadJsonOrBytes(
    bytes: Uint8Array,
    name: string,
    type: string,
  ): void {
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(bytes)], { type }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  private async _convert(
    message: object,
    signal?: AbortSignal,
  ): Promise<unknown> {
    signal?.throwIfAborted()
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL('./bundle-file.worker.ts', import.meta.url),
        { type: 'module' },
      )
      const finish = (error?: unknown, result?: unknown) => {
        worker.terminate()
        signal?.removeEventListener('abort', abort)
        if (error) {
          reject(error)
        }
        else {
          resolve(result)
        }
      }
      function abort() {
        finish(signal?.reason ?? new Error('Операция отменена'))
      }
      signal?.addEventListener('abort', abort, { once: true })
      worker.onmessage = event =>
        finish(
          event.data.error ? new Error(event.data.error) : undefined,
          event.data.result,
        )
      worker.onerror = event => finish(new Error(event.message))
      try {
        worker.postMessage(message)
      }
      catch (error) {
        finish(error)
      }
    })
  }
}
