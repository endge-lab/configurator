import type { AgentTableActions_Module } from '@/features/endge-ide/modules/AgentTableActions_Module'
import type { AuthProfileEditorRegistry_Module } from '@/features/endge-ide/modules/AuthProfileEditorRegistry_Module'
import type { EndgeIDEDocumentImport_Module } from '@/features/endge-ide/modules/document-import/EndgeIDEDocumentImport_Module'
import type { EndgeIDEBusy_Module } from '@/features/endge-ide/modules/EndgeIDEBusy_Module'
import type { EndgeIDEDemonstration_Module } from '@/features/endge-ide/modules/EndgeIDEDemonstration_Module'
import type { EndgeIDEDomainDrag_Module } from '@/features/endge-ide/modules/EndgeIDEDomainDrag_Module'
import type { EndgeIDEDomainTransfer_Module } from '@/features/endge-ide/modules/EndgeIDEDomainTransfer_Module'
import type { EndgeIDEHotkeys_Module } from '@/features/endge-ide/modules/EndgeIDEHotkeys_Module'
import type { EndgeIDEModals_Module } from '@/features/endge-ide/modules/EndgeIDEModals_Module'
import type { EndgeIDEProblems_Module } from '@/features/endge-ide/modules/EndgeIDEProblems_Module'
import type { EndgeIDERuntimePreview_Module } from '@/features/endge-ide/modules/EndgeIDERuntimePreview_Module'
import type { EndgeIDEUIState_Module } from '@/features/endge-ide/modules/EndgeIDEUIState_Module'
import type { EndgeIDEWidgets_Module } from '@/features/endge-ide/modules/EndgeIDEWidgets_Module'
import type { EndgeIDEIntegrations_Module } from '@/features/endge-ide/modules/integrations/EndgeIDEIntegrations_Module'
import type { SourceEditorDialogs_Module } from '@/features/endge-ide/modules/SourceEditorDialogs_Module'
import type { EndgeIDETabs_Module } from '@/features/endge-ide/modules/tabs/EndgeIDETabs_Module'

export interface EndgeIDEContextPort {
  readonly isSwitchingContext: boolean
  registerSurface: (id: string, lifecycle: {
    beforeContextReset?: () => Promise<void> | void
    afterContextBoot?: () => Promise<void> | void
  }) => () => void
}

export interface EndgeIDEModules {
  busy: EndgeIDEBusy_Module
  agentTableActions: AgentTableActions_Module
  demonstration: EndgeIDEDemonstration_Module
  domainDrag: EndgeIDEDomainDrag_Module
  domainTransfer: EndgeIDEDomainTransfer_Module
  documentImport: EndgeIDEDocumentImport_Module
  modals: EndgeIDEModals_Module
  tabs: EndgeIDETabs_Module
  uiState: EndgeIDEUIState_Module
  widgets: EndgeIDEWidgets_Module
  hotkeys: EndgeIDEHotkeys_Module
  runtimePreview: EndgeIDERuntimePreview_Module
  problems: EndgeIDEProblems_Module
  sourceEditorDialogs: SourceEditorDialogs_Module
  authProfileEditors: AuthProfileEditorRegistry_Module
  integrations: EndgeIDEIntegrations_Module
}
