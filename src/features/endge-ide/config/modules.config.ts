import type { IntegrationModule } from '@endge/integration-api'
import type { EndgeIDEContextPort, EndgeIDEModules } from '@/features/endge-ide/domain/types/endge-ide-modules.type'

import { UIEditorStorage_Adapter } from '@/features/endge-admin-ui-editor/modules/ui-editor/adapters/UIEditorStorage_Adapter'
import { createUIEditorModule } from '@/features/endge-admin-ui-editor/modules/ui-editor/UIEditor_Module'
import { ServiceBackendDomainTransferHttp_Adapter } from '@/features/endge-ide/adapters/backend/ServiceBackendDomainTransferHttp_Adapter'
import { EndgeIDEHotkeysBrowser_Adapter } from '@/features/endge-ide/adapters/EndgeIDEHotkeysBrowser_Adapter'
import { getEndgeBackendConfig } from '@/features/endge-ide/config/endge-backend'
import { AgentTableActions_Module } from '@/features/endge-ide/modules/AgentTableActions_Module'
import { AuthProfileEditorRegistry_Module } from '@/features/endge-ide/modules/AuthProfileEditorRegistry_Module'
import { EndgeIDEDocumentImport_Module } from '@/features/endge-ide/modules/document-import/EndgeIDEDocumentImport_Module'
import { EndgeIDEBusy_Module } from '@/features/endge-ide/modules/EndgeIDEBusy_Module'
import { EndgeIDEDemonstration_Module } from '@/features/endge-ide/modules/EndgeIDEDemonstration_Module'
import { EndgeIDEDomainDrag_Module } from '@/features/endge-ide/modules/EndgeIDEDomainDrag_Module'
import { EndgeIDEDomainTransfer_Module } from '@/features/endge-ide/modules/EndgeIDEDomainTransfer_Module'
import { EndgeIDEHotkeys_Module } from '@/features/endge-ide/modules/EndgeIDEHotkeys_Module'
import { EndgeIDEModals_Module } from '@/features/endge-ide/modules/EndgeIDEModals_Module'
import { EndgeIDEProblems_Module } from '@/features/endge-ide/modules/EndgeIDEProblems_Module'
import { EndgeIDERuntimePreview_Module } from '@/features/endge-ide/modules/EndgeIDERuntimePreview_Module'
import { EndgeIDEUIState_Module } from '@/features/endge-ide/modules/EndgeIDEUIState_Module'
import { EndgeIDEWidgets_Module } from '@/features/endge-ide/modules/EndgeIDEWidgets_Module'
import { EndgeIDEIntegrations_Module } from '@/features/endge-ide/modules/integrations/EndgeIDEIntegrations_Module'
import { SourceEditorDialogs_Module } from '@/features/endge-ide/modules/SourceEditorDialogs_Module'
import { EndgeIDETabs_Module } from '@/features/endge-ide/modules/tabs/EndgeIDETabs_Module'

async function loadConfiguratorIntegrations(): Promise<IntegrationModule[]> {
  if (!import.meta.env.DEV && import.meta.env.MODE !== 'test-integrations') {
    return []
  }
  const { default: modules } = await import('virtual:endge-test-integrations')
  return modules
}

/** Создаёт полный граф модулей IDE уровня маршрута. */
export function createEndgeIDEModules(context: EndgeIDEContextPort): EndgeIDEModules {
  const busy = new EndgeIDEBusy_Module()
  const uiState = new EndgeIDEUIState_Module()
  return {
    uiEditor: createUIEditorModule(new UIEditorStorage_Adapter()),
    busy,
    agentTableActions: new AgentTableActions_Module(),
    demonstration: new EndgeIDEDemonstration_Module(),
    domainDrag: new EndgeIDEDomainDrag_Module(),
    domainTransfer: new EndgeIDEDomainTransfer_Module(
      new ServiceBackendDomainTransferHttp_Adapter(getEndgeBackendConfig().serviceBackendURL),
    ),
    documentImport: new EndgeIDEDocumentImport_Module(),
    modals: new EndgeIDEModals_Module(),
    tabs: new EndgeIDETabs_Module(busy, uiState),
    uiState,
    widgets: new EndgeIDEWidgets_Module(),
    hotkeys: new EndgeIDEHotkeys_Module(new EndgeIDEHotkeysBrowser_Adapter()),
    runtimePreview: new EndgeIDERuntimePreview_Module(context),
    problems: new EndgeIDEProblems_Module(),
    sourceEditorDialogs: new SourceEditorDialogs_Module(),
    authProfileEditors: new AuthProfileEditorRegistry_Module(),
    integrations: new EndgeIDEIntegrations_Module(loadConfiguratorIntegrations, context),
  }
}
