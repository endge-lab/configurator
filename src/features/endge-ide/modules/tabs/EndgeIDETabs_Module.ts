import type {
  DiagnosticsEntityRef,
  DomainDocumentType,
  RAction,
  RComponentDSL,
  RComponentTable,
  RComposition,
  RComputation,
  RConfiguration,
  RDataView,
  RMock,
  RQuery,
  RSimulation,
  RStore,
  RStream,
  RType,
  RUpdate,
  SourceDocumentReference,
} from '@endge/core'
import type { Component, ShallowRef } from 'vue'
import type { EndgeIDEBusy_Module } from '@/features/endge-ide/modules/EndgeIDEBusy_Module'
import type { EndgeIDEUIState_Module } from '@/features/endge-ide/modules/EndgeIDEUIState_Module'
import type { EndgeIDEWorkspace_Module } from '@/features/endge-ide/modules/EndgeIDEWorkspace_Module'
import type { DocumentMetadataSession } from '@/features/endge-ide/services/document-metadata-session'
import type { SmartTabRef, SmartTabsApi, SmartTabViewResolved } from '@/features/endge-ide/ui/smart-tabs/types.ts'
import { ComponentType, Endge, FilterType, getDomainDocumentDescriptor, isExternallyManaged, isSystemManaged, QueryType, readOnlyDocument } from '@endge/core'

import { defineAsyncComponent, markRaw, reactive, shallowRef } from 'vue'
import { toast } from 'vue-sonner'
import { getLayoutState, hideWidget, showWidget } from '@/components/layouts/grid/layout'

import { DOCUMENT_AUXILIARY_PRESENTATION, DOCUMENT_ICON_BADGE_SIZE, DOCUMENT_ICON_SIZES } from '@/features/document-presentation/config/document-presentation'
import { getDomainDocumentPresentation } from '@/features/document-presentation/tools/resolve-document-presentation'
import { isIDETabStorageDisabled } from '@/features/endge-ide/config/endge-ide-debug-flags.ts'
import { createEndgeIDETabsConfig } from '@/features/endge-ide/config/tabs.ts'
import { RActionEditor } from '@/features/endge-ide/domain/entities/RActionEditor.ts'
import { RAuthProfileEditor } from '@/features/endge-ide/domain/entities/RAuthProfileEditor.ts'
import { RComponentDSLEditor } from '@/features/endge-ide/domain/entities/RComponentDSLEditor.ts'
import { RComponentSFCEditor } from '@/features/endge-ide/domain/entities/RComponentSFCEditor.ts'
import { RComponentTableEditor } from '@/features/endge-ide/domain/entities/RComponentTableEditor.ts'
import { RCompositionEditor } from '@/features/endge-ide/domain/entities/RCompositionEditor.ts'
import { RComputationEditor } from '@/features/endge-ide/domain/entities/RComputationEditor.ts'
import { RConfigurationEditor } from '@/features/endge-ide/domain/entities/RConfigurationEditor.ts'
import { RConverterEditor } from '@/features/endge-ide/domain/entities/RConverterEditor.ts'
import { RDataViewEditor } from '@/features/endge-ide/domain/entities/RDataViewEditor.ts'
import { FacetDocumentMetadataSession, RFacetDocumentEditor } from '@/features/endge-ide/domain/entities/RFacetDocumentEditor.ts'
import { RFilterEditor } from '@/features/endge-ide/domain/entities/RFilterEditor.ts'
import { RI18nBundleEditor } from '@/features/endge-ide/domain/entities/RI18nBundleEditor.ts'
import { RIntegrationEditor } from '@/features/endge-ide/domain/entities/RIntegrationEditor.ts'
import { RMockEditor } from '@/features/endge-ide/domain/entities/RMockEditor.ts'
import { RNavigationEditor } from '@/features/endge-ide/domain/entities/RNavigationEditor.ts'
import { RPageEditor } from '@/features/endge-ide/domain/entities/RPageEditor.ts'
import { RPageTemplateEditor } from '@/features/endge-ide/domain/entities/RPageTemplateEditor.ts'
import { RPolicyEditor } from '@/features/endge-ide/domain/entities/RPolicyEditor.ts'
import { RQueryEditor } from '@/features/endge-ide/domain/entities/RQueryEditor.ts'
import { RSimulationEditor } from '@/features/endge-ide/domain/entities/RSimulationEditor.ts'
import { RStoreEditor } from '@/features/endge-ide/domain/entities/RStoreEditor.ts'
import { RStreamEditor } from '@/features/endge-ide/domain/entities/RStreamEditor.ts'
import { RStyleEditor } from '@/features/endge-ide/domain/entities/RStyleEditor.ts'
import { RTypeEditor } from '@/features/endge-ide/domain/entities/RTypeEditor.ts'
import { RUpdateEditor } from '@/features/endge-ide/domain/entities/RUpdateEditor.ts'
import { RVocabsEditor } from '@/features/endge-ide/domain/entities/RVocabsEditor.ts'
import { ENDGE_IDE_DOMAIN_WIDGET_ID } from '@/features/endge-ide/domain/types/domain-workspace.types'
import { createDocumentEditorSnapshot } from '@/features/endge-ide/modules/tabs/document-editor-snapshot'
import {
  ENDGE_IDE_DOCUMENT_VIEW_ID,
  getMissingDocumentTabIds,
  resolveEndgeIDEDocumentIdentity,
} from '@/features/endge-ide/modules/tabs/endge-ide-restored-document-tabs'
import { resolveDiagnosticsDocumentTarget } from '@/features/endge-ide/services/diagnostics/diagnostics-document-target'
import { DocumentMetadataSession as DocumentMetadataEditorSession } from '@/features/endge-ide/services/document-metadata-session'
import { getDomainDocumentPath } from '@/features/endge-ide/services/domain/domain-document-path'
import { getDomainDocumentLabel } from '@/features/endge-ide/services/domain/domain-entity-presentation'
import { resolveSourceReferenceDocumentTarget } from '@/features/endge-ide/services/source-reference/source-reference-document-target'
import { ENDGE_IDE_STANDALONE_WORKSPACE_WIDGET_IDS, isStandaloneWorkspaceWidgetActive } from '@/features/endge-ide/tools/endge-ide-workspace-surface'
import { warnDebuggerReadOnly } from '@/features/endge-ide/tools/warn-debugger-read-only'
import { useSmartTabs } from '@/features/endge-ide/ui/smart-tabs'

const TabContentWrapper = defineAsyncComponent(() => import('@/features/endge-ide/ui/components/TabContentWrapper.vue'))
const ComponentDSL_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/ComponentDSL_Editor.vue'))
const ComponentSFC_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/ComponentSFC_Editor.vue'))
const ComponentTable_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/ComponentTable_Editor.vue'))
const Action_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/Action_Editor.vue'))
const Query_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/Query_Editor.vue'))
const DataView_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/DataView_Editor.vue'))
const Composition_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/Composition_Editor.vue'))
const Simulation_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/Simulation_Editor.vue'))
const Store_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/Store_Editor.vue'))
const Stream_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/Stream_Editor.vue'))
const Update_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/Update_Editor.vue'))
const Mock_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/Mock_Editor.vue'))
const Computation_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/Computation_Editor.vue'))
const Type_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/Type_Editor.vue'))
const Converter_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/Converter_Editor.vue'))
const Integration_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/Integration_Editor.vue'))
const Policy_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/Policy_Editor.vue'))
const Style_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/Style_Editor.vue'))
const Configuration_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/Configuration_Editor.vue'))
const Vocabs_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/Vocabs_Editor.vue'))
const AuthProfile_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/AuthProfile_Editor.vue'))
const I18nBundles_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/I18nBundles_Editor.vue'))
const PageTemplate_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/PageTemplate_Editor.vue'))
const Page_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/Page_Editor.vue'))
const Navigation_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/Navigation_Editor.vue'))
const Filter_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/Filter_Editor.vue'))
const FacetDocument_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/entity/FacetDocument_Editor.vue'))
const Workspace_Editor = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/document/singleton/Workspace_Editor.vue'))
const DSL_Playground_Widget = defineAsyncComponent(() => import('@/features/endge-ide/ui/widgets/DSL_Playground_Widget.vue'))
const SFC_Playground_Widget = defineAsyncComponent(() => import('@/features/endge-ide/ui/widgets/SFC_Playground_Widget.vue'))
const DemonstrationTab_View = defineAsyncComponent(() => import('@/features/endge-ide/ui/section/demonstration/DemonstrationTab_View.vue'))

const COMPONENT_SFC_TYPE = 'component-sfc' as DomainDocumentType

const VIEW_ID_DOCUMENT = ENDGE_IDE_DOCUMENT_VIEW_ID
const VIEW_ID_FACET_DOCUMENT = 'endge-facet-document' as const
const VIEW_ID_WORKSPACE_SETTINGS = 'endge-workspace-settings' as const
const VIEW_ID_DSL_PLAYGROUND = 'endge-dsl-playground' as const
const VIEW_ID_SFC_PLAYGROUND = 'endge-sfc-playground' as const
const VIEW_ID_DEMONSTRATION = 'endge-demonstration' as const

interface DocumentTabPayload {
  documentId: string
  documentType: DomainDocumentType
  presentationKind?: string
}

interface DocumentSourceNavigationRequest {
  documentId: string
  documentType: DomainDocumentType
  offset: number
  token: number
}

interface FacetDocumentTabPayload {
  facetIdentity: string
  documentIdentity: string
}

type SupportedViewId = typeof VIEW_ID_DOCUMENT | typeof VIEW_ID_FACET_DOCUMENT

interface ResolvedView {
  component: Component
  props: Record<string, unknown>
}

interface EditorSession {
  view: ResolvedView
  editor: unknown | null
  model: unknown | null
  persistedIdentity?: string
  savedSnapshot?: string
  prepareBeforeSave?: () => boolean | Promise<boolean>
  syncBeforeSave?: () => void
  syncSystemBeforeSave?: () => void
  metadata?: DocumentMetadataSession
}

type DocResolver = (documentId: string) => EditorSession | null

/**
 * Endge IDE Tabs
 *
 * Вкладки + резолв контента, кэш сессий,
 * текущий документ для инспектора, сохранение активной вкладки.
 */
export class EndgeIDETabs_Module {
  private _tabsApi: SmartTabsApi
  private _isRegistryBootstrapped = false
  private _sessionByTabId = new Map<string, EditorSession>()
  private _sourceNavigationToken = 0
  private readonly _documentEditorModel = shallowRef<unknown | null>(null)
  private readonly _documentModel = shallowRef<unknown | null>(null)
  private readonly _documentMetadataSession = shallowRef<DocumentMetadataSession | null>(null)
  private readonly _sourceNavigationRequest = shallowRef<DocumentSourceNavigationRequest | null>(null)

  /** Readonly reactive views текущего editor, model и одноразовой Source navigation. */
  public readonly documentEditorModel: Readonly<ShallowRef<unknown | null>> = this._documentEditorModel
  public readonly documentModel: Readonly<ShallowRef<unknown | null>> = this._documentModel
  public readonly documentMetadataSession: Readonly<ShallowRef<DocumentMetadataSession | null>> = this._documentMetadataSession
  public readonly sourceNavigationRequest: Readonly<ShallowRef<DocumentSourceNavigationRequest | null>> = this._sourceNavigationRequest

  public constructor(
    private readonly _busy: EndgeIDEBusy_Module,
    private readonly _uiState: EndgeIDEUIState_Module,
    private readonly _workspace?: EndgeIDEWorkspace_Module,
  ) {
    this._tabsApi = this._createTabsApi(false)
  }

  /** ACCESS */
  public get openTabs(): SmartTabsApi['openTabs'] {
    return this._tabsApi.openTabs
  }

  /** ACCESS */
  public get activeTab(): SmartTabsApi['activeTab'] {
    return this._tabsApi.activeTab
  }

  /** ACCESS */
  public get activeTabId(): SmartTabsApi['activeTabId'] {
    return this._tabsApi.activeTabId
  }

  /** Реестр принадлежит этому экземпляру tabs и используется SmartTabsHost. */
  public get viewRegistry(): SmartTabsApi['viewRegistry'] {
    return this._tabsApi.viewRegistry
  }

  /** LIFECYCLE */
  public init(): void {
    if (this._isRegistryBootstrapped) {
      return
    }
    this._tabsApi = this._createTabsApi(!isIDETabStorageDisabled())
    this._tabsApi.closeTab('docs')
    this._tabsApi.closeTab('ui-editor-demo-singleton')
    this._tabsApi.closeTab('pulse')
    this._tabsApi.closeTab('architecture')
    this._tabsApi.closeTab('domain-analysis')
    for (const tab of this._tabsApi.openTabs.value) {
      // Старые сохранённые debug-вкладки не имеют view после перехода на Bridge.
      if (tab.viewId === 'endge-runtime-debug') {
        this._tabsApi.closeTab(tab.id)
      }
    }
    this._removeMissingDocumentTabs()
    this._registerSystemViews()
    this._refreshPersistedDocumentTabs()
    this._isRegistryBootstrapped = true
  }

  /** LIFECYCLE */
  public reset(): void {
    this._tabsApi.flushStorage()
    this._tabsApi = this._createTabsApi(false)
    this._isRegistryBootstrapped = false
    this._sessionByTabId.clear()
    this._documentEditorModel.value = null
    this._documentModel.value = null
    this._documentMetadataSession.value = null
  }

  private _createTabsApi(persist: boolean): SmartTabsApi {
    const config = createEndgeIDETabsConfig()
    if (persist) {
      this._uiState.migrateLegacy(config.storageKey, config.legacyStorageKeys)
    }
    return useSmartTabs({
      storageKey: config.storageKey,
      persist,
      maxTabs: config.maxTabs,
      persistence: this._uiState,
      onTabClosed: tab => this._sessionByTabId.delete(tab.id),
    })
  }

  public openTab(tab: SmartTabRef, opts?: { activate?: boolean, replace?: boolean }): void {
    this._tabsApi.openTab(tab, opts)
  }

  public activateTab(id: string): void { this._tabsApi.activateTab(id) }
  public closeTab(id: string): void { this._tabsApi.closeTab(id) }
  public closeAll(): void { this._tabsApi.closeAll() }
  public closeOthers(id: string): void { this._tabsApi.closeOthers(id) }
  public closeAllToLeft(id: string): void { this._tabsApi.closeAllToLeft(id) }
  public closeAllToRight(id: string): void { this._tabsApi.closeAllToRight(id) }

  public moveTab(fromIndex: number, toIndex: number): void { this._tabsApi.moveTab(fromIndex, toIndex) }
  public getTabViewState(tabId: string, key: string) { return this._tabsApi.getTabViewState(tabId, key) }
  public setTabViewState(tabId: string, key: string, slice: Parameters<SmartTabsApi['setTabViewState']>[2]): void { this._tabsApi.setTabViewState(tabId, key, slice) }
  public clearTabViewState(tabId: string, key?: string): void { this._tabsApi.clearTabViewState(tabId, key) }
  public getTabVolatileViewState(tabId: string, key: string) { return this._tabsApi.getTabVolatileViewState(tabId, key) }
  public setTabVolatileViewState(tabId: string, key: string, slice: Parameters<SmartTabsApi['setTabVolatileViewState']>[2]): void { this._tabsApi.setTabVolatileViewState(tabId, key, slice) }
  public clearTabVolatileViewState(tabId: string, key?: string): void { this._tabsApi.clearTabVolatileViewState(tabId, key) }
  public getSharedViewState(key: string) { return this._tabsApi.getSharedViewState(key) }
  public setSharedViewState(key: string, slice: Parameters<SmartTabsApi['setSharedViewState']>[1]): void { this._tabsApi.setSharedViewState(key, slice) }
  public clearSharedViewState(key?: string): void { this._tabsApi.clearSharedViewState(key) }
  public flushStorage(): void { this._tabsApi.flushStorage() }
  public clearStorage(): void { this._tabsApi.clearStorage() }

  /** Возвращает true, когда активный редактор отличается от последнего успешного сохранения. */
  public isTabDirty(id: string): boolean {
    if (id === 'workspace-settings') {
      return (this._workspace?.editor.value?.dirty ?? false) || this._workspace?.metadataSession.value?.dirty === true
    }
    const session = this._sessionByTabId.get(id)
    if (!session?.editor || session.savedSnapshot == null) {
      return false
    }
    return createDocumentEditorSnapshot(session.editor) !== session.savedSnapshot || session.metadata?.dirty === true
  }

  /** Защита Ctrl/Cmd+W. Обычная кнопка закрытия намеренно обходит эту проверку. */
  public closeActiveTabFromHotkey(): void {
    const id = this.activeTabId.value
    if (!id) {
      return
    }
    if (this.isTabDirty(id)) {
      toast.warning('Документ не сохранён', {
        description: 'Сохраните изменения или закройте вкладку крестиком без сохранения.',
      })
      return
    }
    this.closeTab(id)
  }

  public getCurrentContext(): { document: Record<string, unknown> } | null {
    const editor = this.documentEditorModel.value
    const model = this.documentModel.value
    if (editor == null && model == null) {
      return null
    }
    return {
      document: {
        editor: editor ?? undefined,
        previewModel: model ?? undefined,
        component: model ?? undefined,
      },
    }
  }

  public getViewForTab(tab: SmartTabRef): SmartTabViewResolved | null {
    this._syncContextForTab(tab)
    const viewId = tab.viewId as SupportedViewId
    if (viewId === VIEW_ID_DOCUMENT) {
      return this._resolveDocumentTab(tab)
    }
    if (viewId === VIEW_ID_FACET_DOCUMENT) {
      return this._resolveFacetDocumentTab(tab)
    }
    return null
  }

  public async save(): Promise<void> {
    const activeTab = this.activeTab.value
    if (!activeTab) {
      return
    }
    if (activeTab.viewId === VIEW_ID_WORKSPACE_SETTINGS) {
      if (this._busy.value || !this._workspace?.editor.value?.displayName.trim()) {
        return
      }
      try {
        await this._workspace.save()
        toast.success('Рабочее пространство сохранено')
      }
      catch (error) {
        if (!warnDebuggerReadOnly(error)) {
          toast.error('Не удалось сохранить рабочее пространство', { description: error instanceof Error ? error.message : String(error) })
        }
      }
      return
    }
    if (activeTab.viewId === VIEW_ID_FACET_DOCUMENT) {
      await this._busy.run(this._saveFacetDocument(activeTab))
      return
    }
    await this._busy.run(this._doSave(activeTab))
  }

  /** Регистрирует подготовку UI-черновиков активной вкладки перед любым способом сохранения. */
  public registerSavePreparation(handler: () => boolean | Promise<boolean>): () => void {
    const tabId = this.activeTab.value?.id
    const session = tabId ? this._sessionByTabId.get(tabId) : null
    if (!session) {
      return () => {}
    }

    session.prepareBeforeSave = handler
    return () => {
      if (session.prepareBeforeSave === handler) {
        session.prepareBeforeSave = undefined
      }
    }
  }

  private async _doSave(activeTab: SmartTabRef): Promise<void> {
    const viewId = activeTab.viewId as SupportedViewId
    try {
      Endge.assertWritable()
      if (viewId !== VIEW_ID_DOCUMENT) {
        return
      }
      const payload = this._getPayload<DocumentTabPayload>(activeTab.payload)
      const documentId = payload?.documentId
      const documentType = payload?.documentType
      if (!documentId || !documentType) {
        return
      }
      const session = this._sessionByTabId.get(activeTab.id)
      const model = session?.model as { managedBy?: 'system' | 'integration' | 'user', managedById?: string | null } | null | undefined
      if (isExternallyManaged(model)) {
        if (documentType === 'style' && isSystemManaged(model) && session?.syncSystemBeforeSave) {
          session.syncSystemBeforeSave()
        }
        else {
          toast.info(model?.managedBy === 'integration'
            ? 'Документ управляется интеграцией и не может быть изменён'
            : 'Системный документ нельзя изменить')
          return
        }
      }
      else {
        if (session?.metadata && !session.metadata.prepareBeforeSave()) {
          toast.error('Метаданные не сохранены', { description: session.metadata.error ?? 'Исправьте JSON metadata.' })
          return
        }
        if (session?.prepareBeforeSave && !await session.prepareBeforeSave()) {
          return
        }
        session?.syncBeforeSave?.()
      }
      const saveDocumentId = this._resolveSaveDocumentId(documentType, documentId, session?.model ?? null)
      const savingSnapshot = session?.editor ? createDocumentEditorSnapshot(session.editor) : undefined
      await Endge.domainRepository.saveDocument(saveDocumentId, documentType, {
        model: session?.model ?? session?.editor ?? null,
        previousIdentity: session?.persistedIdentity,
      })
      let effectiveDocumentId = saveDocumentId
      if (session?.model && typeof session.model === 'object') {
        const identity = String((session.model as { identity?: unknown }).identity ?? '').trim()
        if (identity) {
          effectiveDocumentId = identity
          session.persistedIdentity = identity
          const tabPayload = this._getPayload<DocumentTabPayload>(activeTab.payload)
          if (tabPayload) {
            tabPayload.documentId = identity
          }
          activeTab.label = this.getDocumentLabel(identity, documentType)
        }
      }
      const label = this.getDocumentLabel(effectiveDocumentId, documentType)
      if (session && savingSnapshot !== undefined) {
        session.savedSnapshot = savingSnapshot
        session.metadata?.acceptSaved()
      }
      toast.success('Сохранено', { description: label })
    }
    catch (e) {
      if (warnDebuggerReadOnly(e)) {
        return
      }
      console.error(`[EndgeIDETabs] save failed: ${e instanceof Error ? e.message : String(e)}`)
      toast.error('Ошибка сохранения', { description: String(e) })
    }
  }

  public openDocument(id: string | number, docType: DomainDocumentType, options: { sourceOffset?: number } = {}): void {
    const documentId = resolveEndgeIDEDocumentIdentity(id, docType)
    const presentationKind = this._getDocumentPresentationKind(documentId, docType)
    const presentation = getDomainDocumentPresentation(docType, presentationKind)
    const tabId = `${String(docType)}-${documentId || 'empty'}`
    const tabRef: SmartTabRef = {
      id: tabId,
      label: documentId ? this.getDocumentLabel(documentId, docType) : 'Без имени',
      viewId: VIEW_ID_DOCUMENT,
      payload: { documentId, documentType: docType, presentationKind } satisfies DocumentTabPayload,
      closable: true,
      meta: {
        icon: presentation.icon,
        iconClass: `${DOCUMENT_ICON_SIZES.tab} ${presentation.colorClass}`,
        iconBadge: presentation.badgeIcon ?? null,
        iconBadgeClass: `${DOCUMENT_ICON_BADGE_SIZE} ${presentation.colorClass}`,
      },
    }
    this.openTab(tabRef)
    if (Number.isFinite(options.sourceOffset)) {
      this._sourceNavigationRequest.value = {
        documentId,
        documentType: docType,
        offset: Math.max(0, Number(options.sourceOffset)),
        token: ++this._sourceNavigationToken,
      }
    }
  }

  /** Открывает вложенный документ по составному ключу фасета и документа. */
  public openFacetDocument(facetIdentity: string, documentIdentity: string): void {
    const facet = Endge.domain.getFacet(facetIdentity)
    const document = Endge.domain.getFacetDocument(facetIdentity, documentIdentity)
    if (!facet || !document) {
      toast.warning('Документ фасета не найден')
      return
    }
    const tabRef: SmartTabRef = {
      id: `facet-document:${encodeURIComponent(facetIdentity)}:${encodeURIComponent(documentIdentity)}`,
      label: document.displayName || document.identity,
      viewId: VIEW_ID_FACET_DOCUMENT,
      payload: { facetIdentity, documentIdentity } satisfies FacetDocumentTabPayload,
      closable: true,
      meta: { icon: facet.icon, iconClass: DOCUMENT_ICON_SIZES.tab, iconColor: facet.color },
    }
    this.openTab(tabRef)
  }

  /** Разрешает diagnostics entity reference и открывает исходный authoring document. */
  public openDiagnosticsEntity(reference: DiagnosticsEntityRef): boolean {
    const target = resolveDiagnosticsDocumentTarget(reference)
    if (!target) {
      toast.warning('Сущность не найдена', {
        description: `${reference.entityType} "${reference.identity || String(reference.id)}" отсутствует в текущем домене.`,
      })
      return false
    }
    if (!this._getDocResolver(target.documentType)) {
      toast.warning('Сущность пока нельзя открыть', {
        description: `Редактор для типа "${String(target.documentType)}" не зарегистрирован.`,
      })
      return false
    }
    this.openDocument(target.documentId, target.documentType)
    return true
  }

  /** Открывает внешний документ из semantic source reference. */
  public openSourceReference(reference: SourceDocumentReference): boolean {
    const target = resolveSourceReferenceDocumentTarget(reference)
    if (!target) {
      toast.warning('Документ не найден', {
        description: `${this._sourceReferenceLabel(reference.target)} "${reference.identity}" не найден.`,
      })
      return false
    }
    if (!this._getDocResolver(target.documentType)) {
      toast.warning('Документ нельзя открыть', {
        description: `Тип "${String(target.documentType)}" пока не поддерживается редактором.`,
      })
      return false
    }
    this.openDocument(target.documentId, target.documentType)
    return true
  }

  public openWorkspaceSettings(): void {
    const workspace = Endge.workspace.current
    const label = workspace.displayName || workspace.identity || 'Workspace'
    const tabRef: SmartTabRef = {
      id: 'workspace-settings',
      label: `Рабочее пространство: ${label}`,
      viewId: VIEW_ID_WORKSPACE_SETTINGS,
      payload: {},
      closable: true,
      singleton: true,
      meta: this._workspaceTabMeta(),
    }
    this.openTab(tabRef)
    showWidget(ENDGE_IDE_DOMAIN_WIDGET_ID)

    const widgets = getLayoutState().widgets.value
    ENDGE_IDE_STANDALONE_WORKSPACE_WIDGET_IDS.forEach((widgetId) => {
      if (isStandaloneWorkspaceWidgetActive(widgets, widgetId)) {
        hideWidget(widgetId)
      }
    })
  }

  /** Открыть DSL Песочницу в единственном экземпляре (при повторном вызове - активация вкладки). */
  public openDSLPlayground(): void {
    const tabRef: SmartTabRef = {
      id: 'dsl-playground',
      label: 'DSL Песочница',
      viewId: VIEW_ID_DSL_PLAYGROUND,
      payload: {},
      closable: true,
      singleton: true,
      meta: { icon: 'ti ti-device-gamepad-3 text-orange-500 text-xl' },
    }
    this.openTab(tabRef)
  }

  /** Открыть SFC Playground в единственном экземпляре (при повторном вызове - активация вкладки). */
  public openSFCPlayground(): void {
    const tabRef: SmartTabRef = {
      id: 'sfc-playground',
      label: 'SFC Playground',
      viewId: VIEW_ID_SFC_PLAYGROUND,
      payload: {},
      closable: true,
      singleton: true,
      meta: { icon: 'ti ti-code-dots text-emerald-500 text-xl' },
    }
    this.openTab(tabRef)
  }

  /** Открыть вкладку «Демонстрация» в единственном экземпляре. */
  public openDemonstrationTab(): void {
    const tabRef: SmartTabRef = {
      id: 'demonstration',
      label: 'Демонстрация',
      viewId: VIEW_ID_DEMONSTRATION,
      payload: {},
      closable: true,
      singleton: true,
      meta: { icon: 'ti ti-table text-green-500 text-xl' },
    }
    this.openTab(tabRef)
  }

  public getDocumentLabel(id: string, docType: DomainDocumentType): string {
    return getDomainDocumentLabel(id, docType)
  }

  public getTabDomainPath(tab: SmartTabRef): string | null {
    if (tab.viewId !== VIEW_ID_DOCUMENT) {
      return null
    }
    const payload = this._getPayload<DocumentTabPayload>(tab.payload)
    if (!payload?.documentId || !payload.documentType) {
      return null
    }
    return getDomainDocumentPath(payload.documentId, payload.documentType)
  }

  /** Синхронизирует представление восстановленных document-вкладок с загруженным доменом. */
  /** Открывает ту же Workspace-сессию сразу на Workflow, в том числе из её настроек. */
  public openWorkspaceWorkflow(): void {
    this.openWorkspaceSettings()
    this._tabsApi.setTabViewState('workspace-settings', 'workspace.active-tab', { version: 1, value: 'workflow' })
  }

  private _workspaceTabMeta(): Record<string, unknown> {
    const presentation = DOCUMENT_AUXILIARY_PRESENTATION.workspace
    return { icon: presentation.icon, iconClass: `${DOCUMENT_ICON_SIZES.tab} ${presentation.colorClass}` }
  }

  private _refreshPersistedDocumentTabs(): void {
    for (const tab of this.openTabs.value) {
      if (tab.viewId === VIEW_ID_WORKSPACE_SETTINGS) {
        tab.meta = this._workspaceTabMeta()
        continue
      }
      if (tab.viewId !== VIEW_ID_DOCUMENT) {
        continue
      }
      const payload = this._getPayload<DocumentTabPayload>(tab.payload)
      if (!payload) {
        continue
      }
      tab.label = this.getDocumentLabel(payload.documentId, payload.documentType)
      const presentationKind = this._getDocumentPresentationKind(
        payload.documentId,
        payload.documentType,
        payload.presentationKind,
      )
      const presentation = getDomainDocumentPresentation(payload.documentType, presentationKind)
      tab.meta = {
        ...tab.meta,
        icon: presentation.icon,
        iconClass: `${DOCUMENT_ICON_SIZES.tab} ${presentation.colorClass}`,
        iconBadge: presentation.badgeIcon ?? null,
        iconBadgeClass: `${DOCUMENT_ICON_BADGE_SIZE} ${presentation.colorClass}`,
      }
    }
  }

  /** Удаляет восстановленные вкладки документов, которых больше нет в загруженном домене. */
  private _removeMissingDocumentTabs(): void {
    for (const tabId of getMissingDocumentTabIds(this.openTabs.value)) {
      this._tabsApi.closeTab(tabId)
    }
  }

  private _getDocumentPresentationKind(
    documentId: string,
    documentType: DomainDocumentType,
    fallback?: string,
  ): string | undefined {
    if (String(documentType) !== 'composition') {
      return undefined
    }
    const composition = Endge.domain.getComposition(documentId)
    if (composition == null) {
      return fallback
    }
    return String(composition.kind ?? 'library')
  }

  private _sourceReferenceLabel(target: SourceDocumentReference['target']): string {
    return {
      'action': 'Action',
      'auth-profile': 'Auth profile',
      'component': 'Component',
      'composition': 'Composition',
      'computation': 'Computation',
      'converter': 'Converter',
      'data-view': 'DataView',
      'filter': 'Filter',
      'i18n-bundles': 'Словарь переводов',
      'mock': 'Mock',
      'query': 'Query',
      'store': 'Store',
      'style': 'Style',
      'stream': 'Stream',
      'type': 'Type',
      'update': 'Update',
      'vocabs': 'Vocab',
    }[target]
  }

  private _registerSystemViews(): void {
    const wrap = (tab: SmartTabRef): SmartTabViewResolved => ({
      component: markRaw(TabContentWrapper),
      props: { tab },
    })
    this._tabsApi.viewRegistry.register(VIEW_ID_DOCUMENT, wrap)
    this._tabsApi.viewRegistry.register(VIEW_ID_FACET_DOCUMENT, wrap)
    this._tabsApi.viewRegistry.register(VIEW_ID_WORKSPACE_SETTINGS, (): SmartTabViewResolved => ({
      component: markRaw(Workspace_Editor),
      props: {},
    }))
    this._tabsApi.viewRegistry.register(VIEW_ID_DSL_PLAYGROUND, (): SmartTabViewResolved => ({
      component: markRaw(DSL_Playground_Widget),
      props: {},
    }))
    this._tabsApi.viewRegistry.register(VIEW_ID_SFC_PLAYGROUND, (): SmartTabViewResolved => ({
      component: markRaw(SFC_Playground_Widget),
      props: {},
    }))
    this._tabsApi.viewRegistry.register(VIEW_ID_DEMONSTRATION, (): SmartTabViewResolved => ({
      component: markRaw(DemonstrationTab_View),
      props: {},
    }))
  }

  private _resolveDocumentTab(tab: SmartTabRef): SmartTabViewResolved | null {
    const payload = this._getPayload<DocumentTabPayload>(tab.payload)
    const documentId = payload?.documentId
    const documentType = payload?.documentType
    if (!documentId || !documentType) {
      return null
    }
    const cached = this._sessionByTabId.get(tab.id)
    if (cached) {
      this._setCurrentFromSession(cached)
      return cached.view
    }
    const resolver = this._getDocResolver(documentType)
    const session = resolver?.(documentId) ?? null
    if (!session) {
      return null
    }
    if (session.model && typeof session.model === 'object') {
      const identity = String((session.model as { identity?: unknown }).identity ?? '').trim()
      session.persistedIdentity = identity || documentId
    }
    if (Endge.mode === 'debugger' && session.editor) {
      session.editor = readOnlyDocument(session.editor as object)
      session.view.props.tabContext = { editor: session.editor }
    }
    if (getDomainDocumentDescriptor(documentType).capabilities.metadata && session.editor && session.model && typeof session.editor === 'object' && typeof session.model === 'object') {
      session.metadata = reactive(new DocumentMetadataEditorSession(
        documentType,
        session.editor as Record<string, unknown>,
        session.model as Record<string, unknown>,
        Endge.mode === 'debugger' || isExternallyManaged(session.model as { managedBy?: 'system' | 'integration' | 'user' }),
      )) as DocumentMetadataSession
    }
    if (session.editor) {
      session.savedSnapshot = createDocumentEditorSnapshot(session.editor)
    }
    this._sessionByTabId.set(tab.id, session)
    this._setCurrentFromSession(session)
    return session.view
  }

  private _resolveFacetDocumentTab(tab: SmartTabRef): SmartTabViewResolved | null {
    const cached = this._sessionByTabId.get(tab.id)
    if (cached) {
      this._setCurrentFromSession(cached)
      return cached.view
    }
    const payload = this._getPayload<FacetDocumentTabPayload>(tab.payload)
    if (!payload) {
      return null
    }
    const document = Endge.domain.getFacetDocument(payload.facetIdentity, payload.documentIdentity)
    if (!document) {
      return null
    }
    const rawEditor = new RFacetDocumentEditor()
    rawEditor.fillFromSource(document)
    const editor = reactive(rawEditor as object) as RFacetDocumentEditor
    const metadata = reactive(new FacetDocumentMetadataSession(editor)) as unknown as DocumentMetadataSession
    const session: EditorSession = {
      view: { component: markRaw(FacetDocument_Editor), props: {} },
      editor,
      model: document,
      persistedIdentity: document.identity,
      metadata,
      savedSnapshot: createDocumentEditorSnapshot(editor),
    }
    this._sessionByTabId.set(tab.id, session)
    this._setCurrentFromSession(session)
    return session.view
  }

  private async _saveFacetDocument(tab: SmartTabRef): Promise<void> {
    try {
      const payload = this._getPayload<FacetDocumentTabPayload>(tab.payload)
      const session = this._sessionByTabId.get(tab.id)
      const editor = session?.editor as RFacetDocumentEditor | null
      if (!payload || !session || !editor) {
        return
      }
      if (session.metadata && !session.metadata.prepareBeforeSave()) {
        toast.error('Метаданные не сохранены', { description: session.metadata.error ?? 'Исправьте JSON metadata.' })
        return
      }
      const previousIdentity = session.persistedIdentity ?? payload.documentIdentity
      const next = await Endge.domainRepository.updateFacetDocument(payload.facetIdentity, previousIdentity, editor.toMutation())
      session.model = next
      session.persistedIdentity = next.identity
      payload.documentIdentity = next.identity
      tab.label = next.displayName || next.identity
      session.savedSnapshot = createDocumentEditorSnapshot(editor)
      session.metadata?.acceptSaved()
      toast.success('Сохранено', { description: `${payload.facetIdentity} / ${next.identity}` })
    }
    catch (error) {
      toast.error('Ошибка сохранения', { description: error instanceof Error ? error.message : String(error) })
    }
  }

  private _getDocResolver(docType: DomainDocumentType): DocResolver | null {
    return this._docResolvers.get(String(docType)) ?? null
  }

  private readonly _docResolvers: Map<string, DocResolver> = new Map([
    [String(ComponentType.Table), documentId => this._resolveComponentTable(documentId)],
    [String(ComponentType.DSL), documentId => this._resolveComponentDSL(documentId)],
    [String(COMPONENT_SFC_TYPE), documentId => this._resolveComponentSFC(documentId)],
    [String(QueryType.REST), documentId => this._resolveQuery(documentId)],
    [String(QueryType.GraphQL), documentId => this._resolveQuery(documentId)],
    [String(QueryType.Custom), documentId => this._resolveQuery(documentId)],
    ['data-view', documentId => this._resolveDataView(documentId)],
    ['composition', documentId => this._resolveComposition(documentId)],
    ['simulation', documentId => this._resolveSimulation(documentId)],
    ['store', documentId => this._resolveStore(documentId)],
    ['stream', documentId => this._resolveStream(documentId)],
    ['update', documentId => this._resolveUpdate(documentId)],
    ['mock', documentId => this._resolveMock(documentId)],
    ['action', documentId => this._resolveAction(documentId)],
    [String(FilterType.DefaultFilter), documentId => this._resolveFilter(documentId)],
    ['converter', documentId => this._resolveConverter(documentId)],
    ['computation', documentId => this._resolveComputation(documentId)],
    ['integration', documentId => this._resolveIntegration(documentId)],
    ['policy', documentId => this._resolvePolicy(documentId)],
    ['style', documentId => this._resolveStyle(documentId)],
    ['configuration', documentId => this._resolveConfiguration(documentId)],
    ['vocabs', documentId => this._resolveVocabs(documentId)],
    ['auth-profile', documentId => this._resolveAuthProfile(documentId)],
    ['i18n-bundles', documentId => this._resolveI18nBundle(documentId)],
    ['page-template', documentId => this._resolvePageTemplate(documentId)],
    ['page', documentId => this._resolvePage(documentId)],
    ['navigation', documentId => this._resolveNavigation(documentId)],
    ['type', documentId => this._resolveType(documentId)],
  ])

  private _resolveComponentTable(documentId: string): EditorSession | null {
    const component = Endge.domain.getComponent(documentId) as RComponentTable | null
    if (!component) {
      return null
    }
    const editor = new RComponentTableEditor()
    editor.fillFromSource(component)
    return {
      view: {
        component: markRaw(ComponentTable_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: component,
      syncBeforeSave: () => {
        if (typeof (editor as unknown as { updateSource?: (m: unknown) => void }).updateSource === 'function') {
          (editor as unknown as { updateSource: (m: unknown) => void }).updateSource(component)
        }
      },
    }
  }

  private _resolveComponentDSL(documentId: string): EditorSession | null {
    const component = Endge.domain.getComponent(documentId) as RComponentDSL | null
    if (!component) {
      return null
    }
    const editor = new RComponentDSLEditor()
    editor.fillFromSource(component)
    return {
      view: {
        component: markRaw(ComponentDSL_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: component,
      syncBeforeSave: () => {
        if (typeof (editor as unknown as { updateSource?: (m: unknown) => void }).updateSource === 'function') {
          (editor as unknown as { updateSource: (m: unknown) => void }).updateSource(component)
        }
      },
    }
  }

  private _resolveComponentSFC(documentId: string): EditorSession | null {
    const component = (Endge.domain as any).getComponentSFC?.(documentId) ?? null
    if (!component) {
      return null
    }
    const editor = new RComponentSFCEditor()
    editor.fillFromSource(component)
    return {
      view: {
        component: markRaw(ComponentSFC_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: component,
      syncBeforeSave: () => editor.updateSource(component),
    }
  }

  private _resolveType(documentId: string): EditorSession | null {
    const rType = Endge.domain.getType(documentId) as RType | null
    if (!rType || rType.isPrimitive) {
      return null
    }
    const editor = new RTypeEditor()
    editor.fillFromSource(rType)
    return {
      view: { component: markRaw(Type_Editor), props: { tabContext: { editor } } },
      editor,
      model: rType,
      persistedIdentity: rType.identity,
      syncBeforeSave: () => {
        if (typeof (editor as unknown as { updateSource?: (m: unknown) => void }).updateSource === 'function') {
          (editor as unknown as { updateSource: (m: unknown) => void }).updateSource(rType)
        }
      },
    }
  }

  private _resolveAction(documentId: string): EditorSession | null {
    const action = Endge.domain.getAction(documentId) as RAction | null
    if (!action) {
      return null
    }
    const rawEditor = new RActionEditor()
    rawEditor.fillFromSource(action)
    const editor = reactive(rawEditor as object) as RActionEditor
    return {
      view: {
        component: markRaw(Action_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: action,
      syncBeforeSave: () => editor.updateSource(action),
    }
  }

  private _resolveQuery(documentId: string): EditorSession | null {
    const query = Endge.domain.getQuery(documentId) as RQuery | null
    if (!query) {
      return null
    }
    const editor = new RQueryEditor()
    editor.fillFromSource(query)
    return {
      view: { component: markRaw(Query_Editor), props: { tabContext: { editor } } },
      editor,
      model: query,
      syncBeforeSave: () => editor.updateSource(query),
    }
  }

  private _resolveDataView(documentId: string): EditorSession | null {
    const dataView = Endge.domain.getDataView(documentId) as RDataView | null
    if (!dataView) {
      return null
    }
    const editor = new RDataViewEditor()
    editor.fillFromSource(dataView)
    return {
      view: { component: markRaw(DataView_Editor), props: { tabContext: { editor } } },
      editor,
      model: dataView,
      syncBeforeSave: () => editor.updateSource(dataView),
    }
  }

  private _resolveComposition(documentId: string): EditorSession | null {
    const composition = Endge.domain.getComposition(documentId) as RComposition | null
    if (!composition) {
      return null
    }
    const rawEditor = new RCompositionEditor()
    rawEditor.fillFromSource(composition)
    const editor = reactive(rawEditor as object) as RCompositionEditor
    return {
      view: { component: markRaw(Composition_Editor), props: { tabContext: { editor } } },
      editor,
      model: composition,
      syncBeforeSave: () => editor.updateSource(composition),
    }
  }

  private _resolveSimulation(documentId: string): EditorSession | null {
    const simulation = Endge.domain.getSimulation(documentId) as RSimulation | null
    if (!simulation) {
      return null
    }
    const rawEditor = new RSimulationEditor()
    rawEditor.fillFromSource(simulation)
    const editor = reactive(rawEditor as object) as RSimulationEditor
    return {
      view: { component: markRaw(Simulation_Editor), props: { tabContext: { editor } } },
      editor,
      model: simulation,
      syncBeforeSave: () => editor.updateSource(simulation),
    }
  }

  private _resolveStore(documentId: string): EditorSession | null {
    const store = Endge.domain.getStore(documentId) as RStore | null
    if (!store) {
      return null
    }
    const rawEditor = new RStoreEditor()
    rawEditor.fillFromSource(store)
    const editor = reactive(rawEditor as object) as RStoreEditor
    return {
      view: { component: markRaw(Store_Editor), props: { tabContext: { editor } } },
      editor,
      model: store,
      syncBeforeSave: () => editor.updateSource(store),
    }
  }

  private _resolveStream(documentId: string): EditorSession | null {
    const stream = Endge.domain.getStream(documentId) as RStream | null
    if (!stream) {
      return null
    }
    const rawEditor = new RStreamEditor()
    rawEditor.fillFromSource(stream)
    const editor = reactive(rawEditor as object) as RStreamEditor
    return {
      view: { component: markRaw(Stream_Editor), props: { tabContext: { editor } } },
      editor,
      model: stream,
      syncBeforeSave: () => editor.updateSource(stream),
    }
  }

  private _resolveUpdate(documentId: string): EditorSession | null {
    const update = Endge.domain.getUpdate(documentId) as RUpdate | null
    if (!update) {
      return null
    }
    const rawEditor = new RUpdateEditor()
    rawEditor.fillFromSource(update)
    const editor = reactive(rawEditor as object) as RUpdateEditor
    return {
      view: { component: markRaw(Update_Editor), props: { tabContext: { editor } } },
      editor,
      model: update,
      syncBeforeSave: () => editor.updateSource(update),
    }
  }

  private _resolveMock(documentId: string): EditorSession | null {
    const mock = Endge.domain.getMock(documentId) as RMock | null
    if (!mock) {
      return null
    }
    const rawEditor = new RMockEditor()
    rawEditor.fillFromSource(mock)
    const editor = reactive(rawEditor as object) as RMockEditor
    return {
      view: { component: markRaw(Mock_Editor), props: { tabContext: { editor } } },
      editor,
      model: mock,
      syncBeforeSave: () => editor.updateSource(mock),
    }
  }

  private _resolveFilter(documentId: string): EditorSession | null {
    const filter = Endge.domain.getFilter(documentId)
    if (!filter) {
      return null
    }
    const rawEditor = new RFilterEditor()
    rawEditor.fillFromSource(filter)
    const editor = reactive(rawEditor as object) as RFilterEditor
    return {
      view: {
        component: markRaw(Filter_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: filter,
      syncBeforeSave: () => editor.updateSource(filter),
    }
  }

  private _resolveConverter(documentId: string): EditorSession | null {
    const converter = Endge.domain.getConverter(documentId)
    if (!converter) {
      return null
    }
    const editor = new RConverterEditor()
    editor.fillFromSource(converter)
    return {
      view: {
        component: markRaw(Converter_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: converter,
      syncBeforeSave: () => editor.updateSource(converter),
    }
  }

  private _resolveComputation(documentId: string): EditorSession | null {
    const computation = Endge.domain.getComputation(documentId) as RComputation | null
    if (!computation) {
      return null
    }
    const rawEditor = new RComputationEditor()
    rawEditor.fillFromSource(computation)
    const editor = reactive(rawEditor as object) as RComputationEditor
    return {
      view: {
        component: markRaw(Computation_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: computation,
      syncBeforeSave: () => editor.updateSource(computation),
    }
  }

  private _resolveIntegration(documentId: string): EditorSession | null {
    const integration = Endge.domain.getIntegration(documentId)
    if (!integration) {
      return null
    }
    const editor = new RIntegrationEditor()
    editor.fillFromSource(integration)
    return {
      view: {
        component: markRaw(Integration_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: integration,
      syncBeforeSave: () => editor.updateSource(integration),
    }
  }

  private _resolvePolicy(documentId: string): EditorSession | null {
    const policy = Endge.domain.getPolicy(documentId)
    if (!policy) {
      return null
    }
    const editor = new RPolicyEditor()
    editor.fillFromSource(policy)
    return {
      view: {
        component: markRaw(Policy_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: policy,
      syncBeforeSave: () => editor.updateSource(policy),
    }
  }

  private _resolveStyle(documentId: string): EditorSession | null {
    const style = Endge.domain.getStyle(documentId)
    if (!style) {
      return null
    }
    const rawEditor = new RStyleEditor()
    rawEditor.fillFromSource(style)
    const editor = reactive(rawEditor as object) as RStyleEditor
    return {
      view: {
        component: markRaw(Style_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: style,
      syncBeforeSave: () => editor.updateSource(style),
    }
  }

  private _resolveConfiguration(documentId: string): EditorSession | null {
    const configuration = Endge.domain.getConfiguration(documentId) as RConfiguration | null
    if (!configuration) {
      return null
    }
    const rawEditor = new RConfigurationEditor()
    rawEditor.fillFromSource(configuration)
    const editor = reactive(rawEditor as object) as RConfigurationEditor
    return {
      view: {
        component: markRaw(Configuration_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: configuration,
      syncBeforeSave: () => editor.updateSource(configuration),
    }
  }

  private _resolveVocabs(documentId: string): EditorSession | null {
    const vocab = Endge.domain.getVocab(documentId)
    if (!vocab) {
      return null
    }
    const rawEditor = new RVocabsEditor()
    rawEditor.fillFromSource(vocab)
    const editor = reactive(rawEditor as object) as RVocabsEditor
    return {
      view: {
        component: markRaw(Vocabs_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: vocab,
      syncBeforeSave: () => editor.updateSource(vocab),
    }
  }

  private _resolveAuthProfile(documentId: string): EditorSession | null {
    const profile = Endge.domain.getAuthProfile(documentId)
    if (!profile) {
      return null
    }
    const rawEditor = new RAuthProfileEditor()
    rawEditor.fillFromSource(profile)
    const editor = reactive(rawEditor as object) as RAuthProfileEditor
    return {
      view: {
        component: markRaw(AuthProfile_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: profile,
      syncBeforeSave: () => editor.updateSource(profile),
    }
  }

  private _resolveI18nBundle(documentId: string): EditorSession | null {
    const bundle = Endge.domain.getI18nBundle(documentId)
    if (!bundle) {
      return null
    }
    const rawEditor = new RI18nBundleEditor()
    rawEditor.fillFromSource(bundle)
    const editor = reactive(rawEditor as object) as RI18nBundleEditor
    return {
      view: {
        component: markRaw(I18nBundles_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: bundle,
      syncBeforeSave: () => editor.updateSource(bundle),
    }
  }

  private _resolvePageTemplate(documentId: string): EditorSession | null {
    const tpl = Endge.domain.getPageTemplate(documentId)
    if (!tpl) {
      return null
    }
    const rawEditor = new RPageTemplateEditor()
    rawEditor.fillFromSource(tpl)
    const editor = reactive(rawEditor as object) as RPageTemplateEditor
    return {
      view: {
        component: markRaw(PageTemplate_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: tpl,
      syncBeforeSave: () => editor.updateSource(tpl),
    }
  }

  private _resolvePage(documentId: string): EditorSession | null {
    const page = Endge.domain.getPage(documentId)
    if (!page) {
      return null
    }
    const rawEditor = new RPageEditor()
    rawEditor.fillFromSource(page)
    const editor = reactive(rawEditor as object) as RPageEditor
    return {
      view: {
        component: markRaw(Page_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: page,
      syncBeforeSave: () => editor.updateSource(page),
    }
  }

  private _resolveNavigation(documentId: string): EditorSession | null {
    const nav = Endge.domain.getNavigation(documentId)
    if (!nav) {
      return null
    }
    const rawEditor = new RNavigationEditor()
    rawEditor.fillFromSource(nav)
    const editor = reactive(rawEditor as object) as RNavigationEditor
    return {
      view: {
        component: markRaw(Navigation_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: nav,
      syncBeforeSave: () => editor.updateSource(nav),
    }
  }

  private _setCurrentFromSession(session: EditorSession): void {
    this._documentEditorModel.value = session.editor != null ? reactive(session.editor as object) : null
    this._documentModel.value = session.model ?? null
    this._documentMetadataSession.value = session.metadata ?? null
  }

  /** Синхронизирует контекст инспектора с сессией вкладки (чтобы инспектор отображал данные активной вкладки). */
  public syncContextForTab(tab: SmartTabRef | null): void {
    if (!tab) {
      return
    }
    const session = this._sessionByTabId.get(tab.id)
    if (session) {
      this._setCurrentFromSession(session)
    }
  }

  private _syncContextForTab(tab: SmartTabRef): void {
    this.syncContextForTab(tab)
  }

  private _getPayload<T>(payload: unknown): T | null {
    if (!payload || typeof payload !== 'object') {
      return null
    }
    return payload as T
  }

  private _resolveSaveDocumentId(
    documentType: DomainDocumentType,
    fallbackId: string,
    model: unknown,
  ): string {
    if (documentType !== 'page') {
      return fallbackId
    }
    if (Endge.domain.getPage(fallbackId)) {
      return fallbackId
    }
    if (!model || typeof model !== 'object') {
      return fallbackId
    }
    const identity = (model as { identity?: unknown }).identity
    if (typeof identity !== 'string') {
      return fallbackId
    }
    const normalized = identity.trim()
    return normalized || fallbackId
  }
}
