import type { EndgeIDEContextPort, EndgeIDEModules } from '@/features/endge-ide/domain/types/endge-ide-modules.type'
import type { IntegrationModule } from '@endge/integration-api'

import { EndgeIDEBusy_Module } from '@/features/endge-ide/model/modules/busy/EndgeIDEBusy_Module'
import { EndgeIDEDemonstration_Module } from '@/features/endge-ide/model/modules/demonstration/EndgeIDEDemonstration_Module'
import { EndgeIDEDomainDrag_Module } from '@/features/endge-ide/model/modules/domain-drag/EndgeIDEDomainDrag_Module'
import { EndgeIDEFlowCatalog_Module } from '@/features/endge-ide/model/modules/flow-catalog/EndgeIDEFlowCatalog_Module'
import { EndgeIDEHotkeys_Module } from '@/features/endge-ide/model/modules/hotkeys/EndgeIDEHotkeys_Module'
import { EndgeIDEIntegrations_Module } from '@/features/endge-ide/model/modules/integrations/EndgeIDEIntegrations_Module'
import { EndgeIDEModals_Module } from '@/features/endge-ide/model/modules/modals/EndgeIDEModals_Module'
import { EndgeIDEProblems_Module } from '@/features/endge-ide/model/modules/problems/EndgeIDEProblems_Module'
import { AgentTableActions_Module } from '@/features/endge-ide/model/modules/registries/AgentTableActions_Module'
import { AuthProfileEditorRegistry_Module } from '@/features/endge-ide/model/modules/registries/AuthProfileEditorRegistry_Module'
import { EndgeIDERuntimePreview_Module } from '@/features/endge-ide/model/modules/runtime-preview/EndgeIDERuntimePreview_Module'
import { SourceEditorDialogs_Module } from '@/features/endge-ide/model/modules/source-editor-dialogs/SourceEditorDialogs_Module'
import { EndgeIDETabs_Module } from '@/features/endge-ide/model/modules/tabs/EndgeIDETabs_Module'
import { EndgeIDEWidgets_Module } from '@/features/endge-ide/model/modules/widgets/EndgeIDEWidgets_Module'

async function loadConfiguratorIntegrations(): Promise<IntegrationModule[]> {
  if (!import.meta.env.DEV && import.meta.env.MODE !== 'test-integrations') {
    return []
  }
  const { default: modules } = await import('virtual:endge-test-integrations')
  return modules
}

/** Creates the complete route-scoped IDE module graph. */
export function createEndgeIDEModules(context: EndgeIDEContextPort): EndgeIDEModules {
  const busy = new EndgeIDEBusy_Module()
  return {
    busy,
    agentTableActions: new AgentTableActions_Module(),
    demonstration: new EndgeIDEDemonstration_Module(),
    domainDrag: new EndgeIDEDomainDrag_Module(),
    modals: new EndgeIDEModals_Module(),
    tabs: new EndgeIDETabs_Module(busy),
    widgets: new EndgeIDEWidgets_Module(),
    hotkeys: new EndgeIDEHotkeys_Module(),
    flowCatalog: new EndgeIDEFlowCatalog_Module(),
    runtimePreview: new EndgeIDERuntimePreview_Module(context),
    problems: new EndgeIDEProblems_Module(),
    sourceEditorDialogs: new SourceEditorDialogs_Module(),
    authProfileEditors: new AuthProfileEditorRegistry_Module(),
    integrations: new EndgeIDEIntegrations_Module(loadConfiguratorIntegrations, context),
  }
}
