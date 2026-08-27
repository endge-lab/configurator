import type { EndgeIDEBusy_Module } from '@/features/endge-ide/model/modules/busy/EndgeIDEBusy_Module'
import type { EndgeIDEDemonstration_Module } from '@/features/endge-ide/model/modules/demonstration/EndgeIDEDemonstration_Module'
import type { EndgeIDEDomainDrag_Module } from '@/features/endge-ide/model/modules/domain-drag/EndgeIDEDomainDrag_Module'
import type { EndgeIDEDomainTransfer_Module } from '@/features/endge-ide/model/modules/domain-transfer/EndgeIDEDomainTransfer_Module'
import type { EndgeIDEHotkeys_Module } from '@/features/endge-ide/model/modules/hotkeys/EndgeIDEHotkeys_Module'
import type { EndgeIDEIntegrations_Module } from '@/features/endge-ide/model/modules/integrations/EndgeIDEIntegrations_Module'
import type { EndgeIDEModals_Module } from '@/features/endge-ide/model/modules/modals/EndgeIDEModals_Module'
import type { EndgeIDEProblems_Module } from '@/features/endge-ide/model/modules/problems/EndgeIDEProblems_Module'
import type { AgentTableActions_Module } from '@/features/endge-ide/model/modules/registries/AgentTableActions_Module'
import type { AuthProfileEditorRegistry_Module } from '@/features/endge-ide/model/modules/registries/AuthProfileEditorRegistry_Module'
import type { EndgeIDERuntimePreview_Module } from '@/features/endge-ide/model/modules/runtime-preview/EndgeIDERuntimePreview_Module'
import type { SourceEditorDialogs_Module } from '@/features/endge-ide/model/modules/source-editor-dialogs/SourceEditorDialogs_Module'
import type { EndgeIDETabs_Module } from '@/features/endge-ide/model/modules/tabs/EndgeIDETabs_Module'
import type { EndgeIDEUIState_Module } from '@/features/endge-ide/model/modules/ui-state/EndgeIDEUIState_Module'
import type { EndgeIDEWidgets_Module } from '@/features/endge-ide/model/modules/widgets/EndgeIDEWidgets_Module'

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
