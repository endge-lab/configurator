import type { EndgeBundle, EndgeBundleFileFormat } from '@endge/core'
import { EndgeBundleCodec_Service } from '@endge/core'

/** File conversion stays off the UI thread and never installs a Core federation. */
globalThis.onmessage = async (
  event: MessageEvent<{
    operation: 'encode' | 'decode'
    value?: EndgeBundle
    bytes?: Uint8Array
    format?: EndgeBundleFileFormat
  }>,
) => {
  try {
    const codec = new EndgeBundleCodec_Service()
    const result
      = event.data.operation === 'encode'
        ? await codec.encode(event.data.value!, event.data.format)
        : await codec.decode(event.data.bytes!)
    globalThis.postMessage({ result })
  }
  catch (error) {
    globalThis.postMessage({
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
