import type { DiagnosticsEntityRef, DiagnosticsProblemInput } from '@endge/core'
import type { ServiceBackendIntegrationCatalogHttpAdapter } from '@/features/endge-ide/adapters/backend/ServiceBackendIntegrationCatalogHttp_Adapter'
import type { EndgeIDEIntegrations_Module } from '@/features/endge-ide/modules/integrations/EndgeIDEIntegrations_Module'

import { Endge } from '@endge/core'

export async function checkWorkspaceIntegrations(
  transport: ServiceBackendIntegrationCatalogHttpAdapter,
  integrations: EndgeIDEIntegrations_Module,
  signal: AbortSignal,
): Promise<Array<{ entityRef: DiagnosticsEntityRef, problem: DiagnosticsProblemInput }>> {
  if (!Endge.workspace.isLoaded) {
    return []
  }
  const workspace = Endge.workspace.current
  const refs = workspace.installedIntegrations
    .filter(entry => entry.integrationIdentity && !integrations.hasLoadedVersion(entry.integrationIdentity, entry.version))
  if (!refs.length) {
    return []
  }
  const entityRef = { entityType: 'workspace', id: workspace.identity, identity: workspace.identity }
  function issue(code: string, severity: 'error' | 'warning', message: string) {
    return { entityRef, problem: { code, severity, message, sourcePath: 'installedIntegrations' } }
  }
  try {
    const entries = await transport.list(signal)
    const catalog = new Map(entries.map(item => [item.identity, item]))
    return refs.flatMap((entry) => {
      const target = catalog.get(entry.integrationIdentity)
      if (!target || target.active === false) {
        return [issue('workspace-integration-missing', 'error', `Интеграция "${entry.integrationIdentity}" отсутствует в активном каталоге.`)]
      }
      if (String(entry.integrationId) !== String(target.id) || entry.version !== target.version) {
        return [issue('workspace-integration-version-mismatch', 'warning', `Установка "${entry.integrationIdentity}@${entry.version}" не соответствует записи каталога "${target.identity}@${target.version}".`)]
      }
      return []
    })
  }
  catch {
    signal.throwIfAborted()
    return [issue('workspace-integration-catalog-not-checked', 'warning', 'Каталог интеграций недоступен. Установленные версии не проверены.')]
  }
}
