import type { Plugin } from 'vite'

import { existsSync } from 'node:fs'

const VIRTUAL_MODULE_ID = 'virtual:endge-test-integrations'
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`

export interface EndgeTestIntegrationsPluginOptions {
  enabled: boolean
  registryPath: string
}

/** Exposes the external test-integration registry only for local development. */
export function endgeTestIntegrations(
  options: EndgeTestIntegrationsPluginOptions,
): Plugin {
  return {
    name: 'endge-test-integrations',

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID
      }
      return null
    },

    load(id) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID) {
        return null
      }

      if (!options.enabled || !existsSync(options.registryPath)) {
        return 'export default []'
      }

      return `export { default } from ${JSON.stringify(options.registryPath)}`
    },
  }
}
