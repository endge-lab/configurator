import { createQuickJSComputationSandbox } from '@endge/computation-sandbox'

declare global {
  interface Window {
    sandboxFixture: { create: typeof createQuickJSComputationSandbox }
  }
}

// Fixture использует собранный package и настоящий Worker с QuickJS/WASM.
window.sandboxFixture = { create: createQuickJSComputationSandbox }
document.body.dataset.ready = 'true'
