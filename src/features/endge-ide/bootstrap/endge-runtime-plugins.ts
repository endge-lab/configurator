import { EndgeComputationSandboxPlugin } from '@endge/computation-sandbox'
import { Endge } from '@endge/core'

const REQUIRED_RUNTIME_MODULE_KEYS = ['computationSandbox'] as const

/** Runtime-плагины необходимо зарегистрировать до конфигурации федерации Endge. */
if (!Endge.isConfigured) {
  Endge.use(EndgeComputationSandboxPlugin)
}
else {
  const missingModules = REQUIRED_RUNTIME_MODULE_KEYS.filter(key => !Endge.hasModule(key))
  if (missingModules.length > 0) {
    throw new Error(`[EndgeIDE] runtime plugins loaded too late. Missing modules: ${missingModules.join(', ')}`)
  }
}
