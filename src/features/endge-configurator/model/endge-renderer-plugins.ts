import { Endge } from '@endge/core'
import { EndgeShadcnVuePlugin } from '@endge/shadcn-vue'
import { EndgeVuePlugin } from '@endge/vue'

const REQUIRED_RENDERER_MODULE_KEYS = ['vue', 'shadcnVue'] as const

/**
 * Renderer plugins must be registered before any import reads Endge modules and
 * therefore configures the federation. This module is intentionally imported
 * first from main.ts.
 */
if (!Endge.isConfigured) {
  Endge.use(EndgeVuePlugin)
  Endge.use(EndgeShadcnVuePlugin)
}
else {
  const missingModules = REQUIRED_RENDERER_MODULE_KEYS.filter(key => !Endge.hasModule(key))

  if (missingModules.length > 0) {
    throw new Error(
      `[EndgeConfigurator] renderer plugins were loaded after federation configuration. Missing modules: ${missingModules.join(', ')}`,
    )
  }
}
