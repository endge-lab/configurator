import type { SmartTabRef, SmartTabsApi, SmartTabViewResolved } from '@/components/ui/smart-tabs/types.ts'
import type {
  DomainDocumentType,
  RAction,
  RComponentDSL,
  RComponentTable,
  RDataView,
  RComposition,
  RStore,
  RMock,
  RQuery,
  RTenant,
  RType,
} from '@endge/core'
import type { Component } from 'vue'

import { ComponentType, Endge, FilterType, ParameterType, QueryType } from '@endge/core'
import { defineComponent, h, markRaw, reactive, shallowRef } from 'vue'
import { toast } from 'vue-sonner'
import { showWidget } from '@/components/layouts/grid'

import { registerSmartTabView, useSmartTabs } from '@/components/ui/smart-tabs'
import { runBusy } from '@/features/endge-ide/model/core/endge-ide-busy.ts'
import { isIDETabStorageDisabled } from '@/features/endge-ide/model/core/endge-ide-debug-flags.ts'
import { RComponentDSLEditor } from '@/features/endge-ide/domain/entities/RComponentDSLEditor.ts'
import { RComponentSFCEditor } from '@/features/endge-ide/domain/entities/RComponentSFCEditor.ts'
import { RComponentTableEditor } from '@/features/endge-ide/domain/entities/RComponentTableEditor.ts'
import { RActionEditor } from '@/features/endge-ide/domain/entities/RActionEditor.ts'
import { RConverterEditor } from '@/features/endge-ide/domain/entities/RConverterEditor.ts'
import { RDataViewEditor } from '@/features/endge-ide/domain/entities/RDataViewEditor.ts'
import { RCompositionEditor } from '@/features/endge-ide/domain/entities/RCompositionEditor.ts'
import { RStoreEditor } from '@/features/endge-ide/domain/entities/RStoreEditor.ts'
import { RMockEditor } from '@/features/endge-ide/domain/entities/RMockEditor.ts'
import { RIntegrationEditor } from '@/features/endge-ide/domain/entities/RIntegrationEditor.ts'
import { REnvironmentEditor } from '@/features/endge-ide/domain/entities/REnvironmentEditor.ts'
import { RTenantEditor } from '@/features/endge-ide/domain/entities/RTenantEditor.ts'
import { RPolicyEditor } from '@/features/endge-ide/domain/entities/RPolicyEditor.ts'
import { RStyleEditor } from '@/features/endge-ide/domain/entities/RStyleEditor.ts'
import { RVocabsEditor } from '@/features/endge-ide/domain/entities/RVocabsEditor.ts'
import { RAuthProfileEditor } from '@/features/endge-ide/domain/entities/RAuthProfileEditor.ts'
import { RI18nBundleEditor } from '@/features/endge-ide/domain/entities/RI18nBundleEditor.ts'
import { RPageTemplateEditor } from '@/features/endge-ide/domain/entities/RPageTemplateEditor.ts'
import { RPageEditor } from '@/features/endge-ide/domain/entities/RPageEditor.ts'
import { RNavigationEditor } from '@/features/endge-ide/domain/entities/RNavigationEditor.ts'
import { RProjectEditor } from '@/features/endge-ide/domain/entities/RProjectEditor.ts'
import { RViewEditor } from '@/features/endge-ide/domain/entities/RViewEditor.ts'
import { RFilterEditor } from '@/features/endge-ide/domain/entities/RFilterEditor.ts'
import { RParameterEditor } from '@/features/endge-ide/domain/entities/RParameterEditor.ts'
import { RQueryEditor } from '@/features/endge-ide/domain/entities/RQueryEditor.ts'
import { RTypeEditor } from '@/features/endge-ide/domain/entities/RTypeEditor.ts'
import { endgeIDETabsConfig } from '@/features/endge-ide/config/tabs.ts'
import { DOCS_VIEW_ID } from '@/features/endge-ide/model/core/endge-ide-docs.ts'
import { getBehaviorBindingEditorState } from '@/features/endge-ide/model/bindings/behavior-binding-editor-state.ts'
import { getPresentationBindingEditorState } from '@/features/endge-ide/model/bindings/presentation-binding-editor-state.ts'
import {
  isQueryComposition,
  QUERY_COMPOSITION_PRESENTATION_KIND,
} from '@/features/endge-ide/model/domain/query-composition-presentation'
import MarkdownViewer from '@/features/endge-ide/ui/components/MarkdownViewer.vue'
import TabContentWrapper from '@/features/endge-ide/ui/components/TabContentWrapper.vue'
import ComponentDSL_Editor from '@/features/endge-ide/ui/section/document/entity/ComponentDSL_Editor.vue'
import ComponentSFC_Editor from '@/features/endge-ide/ui/section/document/entity/ComponentSFC_Editor.vue'
import ComponentTable_Editor from '@/features/endge-ide/ui/section/document/entity/ComponentTable_Editor.vue'
import Action_Editor from '@/features/endge-ide/ui/section/document/entity/Action_Editor.vue'
import FiltersPanel_Editor from '@/features/endge-ide/ui/section/document/entity/FiltersPanel_Editor.vue'
import Query_Editor from '@/features/endge-ide/ui/section/document/entity/Query_Editor.vue'
import DataView_Editor from '@/features/endge-ide/ui/section/document/entity/DataView_Editor.vue'
import Composition_Editor from '@/features/endge-ide/ui/section/document/entity/Composition_Editor.vue'
import Store_Editor from '@/features/endge-ide/ui/section/document/entity/Store_Editor.vue'
import Mock_Editor from '@/features/endge-ide/ui/section/document/entity/Mock_Editor.vue'
import Type_Editor from '@/features/endge-ide/ui/section/document/entity/Type_Editor.vue'
import Converter_Editor from '@/features/endge-ide/ui/section/document/entity/Converter_Editor.vue'
import Integration_Editor from '@/features/endge-ide/ui/section/document/entity/Integration_Editor.vue'
import Environment_Editor from '@/features/endge-ide/ui/section/document/entity/Environment_Editor.vue'
import Tenant_Editor from '@/features/endge-ide/ui/section/document/entity/Tenant_Editor.vue'
import Policy_Editor from '@/features/endge-ide/ui/section/document/entity/Policy_Editor.vue'
import Style_Editor from '@/features/endge-ide/ui/section/document/entity/Style_Editor.vue'
import Vocabs_Editor from '@/features/endge-ide/ui/section/document/entity/Vocabs_Editor.vue'
import AuthProfile_Editor from '@/features/endge-ide/ui/section/document/entity/AuthProfile_Editor.vue'
import I18nBundles_Editor from '@/features/endge-ide/ui/section/document/entity/I18nBundles_Editor.vue'
import View_Editor from '@/features/endge-ide/ui/section/document/entity/View_Editor.vue'
import PageTemplate_Editor from '@/features/endge-ide/ui/section/document/entity/PageTemplate_Editor.vue'
import Page_Editor from '@/features/endge-ide/ui/section/document/entity/Page_Editor.vue'
import Navigation_Editor from '@/features/endge-ide/ui/section/document/entity/Navigation_Editor.vue'
import Project_Editor from '@/features/endge-ide/ui/section/document/entity/Project_Editor.vue'
import Filter_Editor from '@/features/endge-ide/ui/section/document/entity/Filter_Editor.vue'
import Workspace_Editor from '@/features/endge-ide/ui/section/document/singleton/Workspace_Editor.vue'
import Version_Editor from '@/features/endge-ide/ui/section/document/singleton/Version_Editor.vue'
import ViewGenerator_Editor from '@/features/endge-ide/ui/section/document/singleton/ViewGenerator_Editor.vue'
import ActionPlaygrounds_Singleton from '@/features/endge-ide/ui/section/document/singleton/ActionPlaygrounds_Singleton.vue'
import BackupRestore_Singleton from '@/features/endge-ide/ui/section/document/singleton/BackupRestore_Singleton.vue'
import DSL_Playground_Widget from '@/features/endge-ide/ui/widgets/DSL_Playground_Widget.vue'
import SFC_Playground_Widget from '@/features/endge-ide/ui/widgets/SFC_Playground_Widget.vue'
import DemonstrationTab_View from '@/features/endge-ide/ui/section/demonstration/DemonstrationTab_View.vue'
import Pulse_Tab from '@/features/endge-ide/ui/section/pulse/Pulse_Tab.vue'
import Architecture_Tab from '@/features/endge-ide/ui/section/architecture/Architecture_Tab.vue'
import Domain_Analysis_Tab from '@/features/endge-ide/ui/section/domain-analysis/Domain_Analysis_Tab.vue'
import Runtime_Debug_Tab from '@/features/endge-ide/ui/section/runtime-debug/Runtime_Debug_Tab.vue'
import UIEditorDemo_Singleton from '@/features/endge-admin-ui-editor/ui/UIEditorDemo_Singleton.vue'

const COMPONENT_SFC_TYPE = 'component-sfc' as DomainDocumentType

const VIEW_ID_DOCUMENT = 'endge-document-editor' as const
const VIEW_ID_WORKSPACE_SETTINGS = 'endge-workspace-settings' as const
const VIEW_ID_VERSION = 'endge-version-editor' as const
const VIEW_ID_VIEW_GENERATOR = 'endge-view-generator' as const
const VIEW_ID_DSL_PLAYGROUND = 'endge-dsl-playground' as const
const VIEW_ID_SFC_PLAYGROUND = 'endge-sfc-playground' as const
const VIEW_ID_ACTION_PLAYGROUNDS = 'endge-action-playgrounds' as const
const VIEW_ID_BACKUP_RESTORE = 'endge-backup-restore' as const
const VIEW_ID_UI_EDITOR_DEMO = 'endge-ui-editor-demo' as const
const VIEW_ID_DEMONSTRATION = 'endge-demonstration' as const
const VIEW_ID_PULSE = 'endge-pulse' as const
const VIEW_ID_ARCHITECTURE = 'endge-architecture' as const
const VIEW_ID_DOMAIN_ANALYSIS = 'endge-domain-analysis' as const
const VIEW_ID_RUNTIME_DEBUG = 'endge-runtime-debug' as const

function isQueryDocumentType(value: string): boolean {
  return value === String(QueryType.REST)
    || value === String(QueryType.GraphQL)
    || value === String(QueryType.Custom)
}

interface DocsTabPayload {
  docId?: string
  file?: string
  title?: string
}

interface DocumentTabPayload {
  documentId: string
  documentType: DomainDocumentType
}

interface VersionTabPayload {
  versionId: string
}

interface RuntimeDebugTabPayload {
  id: string
  url?: string
  title?: string
}

type SupportedViewId = typeof VIEW_ID_DOCUMENT | typeof VIEW_ID_VERSION

interface ResolvedView {
  component: Component
  props: Record<string, unknown>
}

interface EditorSession {
  view: ResolvedView
  editor: unknown | null
  model: unknown | null
  syncBeforeSave?: () => void
}

type DocResolver = (documentId: string) => EditorSession | null

/**
 * Endge IDE Tabs
 *
 * Вкладки + резолв контента (document/version/docs), кэш сессий,
 * текущий документ для инспектора, сохранение активной вкладки.
 */
export class EndgeIDETabs {
  private _tabsApi: SmartTabsApi
  private _isRegistryBootstrapped = false
  private _sessionByTabId = new Map<string, EditorSession>()

  /** ACCESS */
  public readonly documentEditorModel = shallowRef<unknown | null>(null)

  /** ACCESS */
  public readonly documentModel = shallowRef<unknown | null>(null)

  public constructor() {
    this._tabsApi = useSmartTabs({
      ...endgeIDETabsConfig,
      persist: !isIDETabStorageDisabled(),
    })
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

  /** LIFECYCLE */
  public init(): void {
    if (this._isRegistryBootstrapped)
      return
    this._registerSystemViews()
    this._registerDocsView()
    this._refreshPersistedMockTabIcons()
    this._isRegistryBootstrapped = true
  }

  /** LIFECYCLE */
  public reset(): void {
    this._tabsApi.closeAll()
    this._tabsApi.clearStorage()
    this._tabsApi = useSmartTabs({
      ...endgeIDETabsConfig,
      persist: !isIDETabStorageDisabled(),
    })
    this._isRegistryBootstrapped = false
    this._sessionByTabId.clear()
    this.documentEditorModel.value = null
    this.documentModel.value = null
  }

  public openTab(tab: SmartTabRef, opts?: { activate?: boolean; replace?: boolean }): void {
    this._tabsApi.openTab(tab, opts)
  }

  public activateTab(id: string): void { this._tabsApi.activateTab(id) }
  public closeTab(id: string): void { this._tabsApi.closeTab(id) }
  public closeAll(): void { this._tabsApi.closeAll() }
  public closeOthers(id: string): void { this._tabsApi.closeOthers(id) }
  public closeAllToLeft(id: string): void { this._tabsApi.closeAllToLeft(id) }
  public closeAllToRight(id: string): void { this._tabsApi.closeAllToRight(id) }
  public moveTab(fromIndex: number, toIndex: number): void { this._tabsApi.moveTab(fromIndex, toIndex) }
  public clearStorage(): void { this._tabsApi.clearStorage() }

  public getCurrentContext(): { document: Record<string, unknown> } | null {
    const editor = this.documentEditorModel.value
    const model = this.documentModel.value
    if (editor == null && model == null)
      return null
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
    if (viewId === VIEW_ID_VERSION)
      return this._resolveVersionTab(tab)
    if (viewId === VIEW_ID_DOCUMENT)
      return this._resolveDocumentTab(tab)
    return null
  }

  public async save(): Promise<void> {
    const activeTab = this.activeTab.value
    if (!activeTab)
      return
    await runBusy(this._doSave(activeTab))
  }

  private async _doSave(activeTab: SmartTabRef): Promise<void> {
    const viewId = activeTab.viewId as SupportedViewId
    try {
      if (viewId === VIEW_ID_VERSION) {
        const payload = this._getPayload<VersionTabPayload>(activeTab.payload)
        const versionId = payload?.versionId
        if (!versionId)
          return
        await Endge.schema.saveDocument(versionId, 'version' as DomainDocumentType)
        toast.success('Сохранено', { description: versionId })
        return
      }
      if (viewId !== VIEW_ID_DOCUMENT)
        return
      const payload = this._getPayload<DocumentTabPayload>(activeTab.payload)
      const documentId = payload?.documentId
      const documentType = payload?.documentType
      if (!documentId || !documentType)
        return
      const session = this._sessionByTabId.get(activeTab.id)
      const model = session?.model as { isSystem?: boolean } | null | undefined
      if (model?.isSystem === true && documentType !== 'style') {
        toast.info('Системный документ нельзя изменить')
        return
      }
      session?.syncBeforeSave?.()
      const saveDocumentId = this._resolveSaveDocumentId(documentType, documentId, session?.model ?? null)
      await Endge.schema.saveDocument(saveDocumentId, documentType, { model: session?.model ?? session?.editor ?? null })
      if ((documentType === 'store' || documentType === 'mock') && session?.model && typeof session.model === 'object') {
        const identity = String((session.model as { identity?: unknown }).identity ?? '').trim()
        if (identity) {
          const tabPayload = this._getPayload<DocumentTabPayload>(activeTab.payload)
          if (tabPayload)
            tabPayload.documentId = identity
          activeTab.label = this.getDocumentLabel(identity, documentType)
        }
      }
      await this._syncBindingsEditorState(documentType, session?.editor ?? null)
      await this._syncPresentationBindingsEditorState(documentType, session?.editor ?? null)
      const label = this.getDocumentLabel(saveDocumentId, documentType)
      toast.success('Сохранено', { description: label })
    }
    catch (e) {
      console.error('[EndgeIDETabs] save', e)
      toast.error('Ошибка сохранения', { description: String(e) })
    }
  }

  public openDocument(id: string | number, docType: DomainDocumentType): void {
    const documentId = id != null && id !== '' ? String(id) : ''
    const presentationKind = String(docType) === 'composition'
      && isQueryComposition(Endge.domain.getComposition(documentId))
      ? QUERY_COMPOSITION_PRESENTATION_KIND
      : undefined
    const tabId = `${String(docType)}-${documentId || 'empty'}`
    const tabRef: SmartTabRef = {
      id: tabId,
      label: documentId ? this.getDocumentLabel(documentId, docType) : 'Без имени',
      viewId: VIEW_ID_DOCUMENT,
      payload: { documentId, documentType: docType } satisfies DocumentTabPayload,
      closable: true,
      meta: { icon: this.getDocumentIcon(docType, presentationKind) },
    }
    this.openTab(tabRef)
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
      meta: { icon: 'ti ti-world text-sky-500 text-xl' },
    }
    this.openTab(tabRef)
  }

  /** Вкладка версий в единственном экземпляре; при повторном вызове - обновление payload и активация. */
  public openVersion(versionId: string): void {
    const version = Endge.domain.getVersion(versionId)
    const label = version?.identity ?? versionId
    const tabRef: SmartTabRef = {
      id: 'version-editor',
      label: `Версия: ${label}`,
      viewId: VIEW_ID_VERSION,
      payload: { versionId } satisfies VersionTabPayload,
      closable: true,
      singleton: true,
      meta: { icon: 'ti ti-git-branch text-xl' },
    }
    this.openTab(tabRef)
  }

  /** Открыть редактор «Генератор» в единственном экземпляре (при повторном вызове - активация вкладки). */
  public openViewGenerator(): void {
    const tabRef: SmartTabRef = {
      id: 'view-generator',
      label: 'Генератор',
      viewId: VIEW_ID_VIEW_GENERATOR,
      payload: {},
      closable: true,
      singleton: true,
      meta: { icon: 'ti ti-forms text-xl' },
    }
    this.openTab(tabRef)
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

  public openActionPlaygroundsSingleton(): void {
    const tabRef: SmartTabRef = {
      id: 'action-playgrounds-singleton',
      label: 'Action Playgrounds',
      viewId: VIEW_ID_ACTION_PLAYGROUNDS,
      payload: {},
      closable: true,
      singleton: true,
      meta: { icon: 'ti ti-route-square text-sky-500 text-xl' },
    }
    this.openTab(tabRef)
  }

  public openBackupRestoreSingleton(): void {
    const tabRef: SmartTabRef = {
      id: 'backup-restore-singleton',
      label: 'Резервное восстановление',
      viewId: VIEW_ID_BACKUP_RESTORE,
      payload: {},
      closable: true,
      singleton: true,
      meta: { icon: 'ti ti-upload text-xl text-emerald-500' },
    }
    this.openTab(tabRef)
  }

  public openUIEditorDemoSingleton(): void {
    const tabRef: SmartTabRef = {
      id: 'ui-editor-demo-singleton',
      label: 'UI редактор (демо)',
      viewId: VIEW_ID_UI_EDITOR_DEMO,
      payload: {},
      closable: true,
      singleton: true,
      meta: { icon: 'ti ti-devices text-xl text-violet-500' },
    }
    this.openTab(tabRef)
    showWidget('ui-library')
    showWidget('inspector')
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

  /** Открыть вкладку «Пульс» в единственном экземпляре. */
  public openPulseTab(): void {
    const tabRef: SmartTabRef = {
      id: 'pulse',
      label: 'Пульс',
      viewId: VIEW_ID_PULSE,
      payload: {},
      closable: true,
      singleton: true,
      meta: { icon: 'HeartPulse', iconClass: 'size-4 text-rose-500' },
    }
    this.openTab(tabRef)
    showWidget('pulse')
  }

  /** Открыть вкладку «Поиск проблем» в единственном экземпляре. */
  public openDomainAnalysis(): void {
    const tabRef: SmartTabRef = {
      id: 'domain-analysis',
      label: 'Поиск проблем',
      viewId: VIEW_ID_DOMAIN_ANALYSIS,
      payload: {},
      closable: true,
      singleton: true,
      meta: { icon: 'ti ti-report-search text-xl' },
    }
    this.openTab(tabRef)
  }

  /** Открыть вкладку «Архитектура» в single tone (singleton) режиме. */
  public openArchitecture(): void {
    const tabRef: SmartTabRef = {
      id: 'architecture',
      label: 'Архитектура',
      viewId: VIEW_ID_ARCHITECTURE,
      payload: {},
      closable: true,
      singleton: true,
      meta: { icon: 'ti ti-git-merge text-cyan-500 text-xl' },
    }
    this.openTab(tabRef)
  }

  /** Открыть вкладку анализа Runtime Debug для конкретной браузерной вкладки. */
  public openRuntimeDebugTab(tab: { id: string; url?: string; title?: string }): void {
    const label = tab.title || tab.url || tab.id
    const tabRef: SmartTabRef = {
      id: `runtime-debug-${tab.id}`,
      label: `Debug: ${label}`,
      viewId: VIEW_ID_RUNTIME_DEBUG,
      payload: {
        id: tab.id,
        url: tab.url,
        title: tab.title,
      } satisfies RuntimeDebugTabPayload,
      closable: true,
      singleton: false,
      meta: { icon: 'ti ti-bug text-xl' },
    }
    this.openTab(tabRef, { activate: true })
  }

  public getDocumentLabel(id: string, docType: DomainDocumentType): string {
    const key = String(docType)
    if (key === String(ComponentType.Table) || key === String(ComponentType.DSL))
      return Endge.domain.getComponent(id)?.name ?? id
    if (key === String(COMPONENT_SFC_TYPE)) {
      const component = (Endge.domain as any).getComponentSFC?.(id)
      return component?.displayName ?? component?.name ?? id
    }
    if (isQueryDocumentType(key))
      return Endge.domain.getQuery(id)?.displayName ?? Endge.domain.getQuery(id)?.name ?? id
    if (key === 'data-view') {
      const dataView = Endge.domain.getDataView(id)
      return dataView?.displayName ?? dataView?.name ?? id
    }
    if (key === 'composition') {
      const composition = Endge.domain.getComposition(id)
      return composition?.displayName ?? composition?.name ?? id
    }
    if (key === 'store') {
      const store = Endge.domain.getStore(id)
      return store?.displayName ?? store?.name ?? id
    }
    if (key === 'mock') {
      const mock = Endge.domain.getMock(id)
      return mock?.displayName ?? mock?.name ?? id
    }
    if (key === 'type' || key === 'primitive')
      return Endge.domain.getType(id)?.name ?? id
    if (key === 'action') {
      const action = Endge.domain.getAction(id)
      return action?.displayName ?? action?.name ?? id
    }
    if (key === String(ParameterType.DefaultParameter))
      return Endge.domain.getParameter(id)?.displayName ?? id
    if (key === String(FilterType.DefaultFilter))
      return Endge.domain.getFilter(id)?.displayName ?? id
    if (key === 'converter')
      return Endge.domain.getConverter(id)?.name ?? id
    if (key === 'integration')
      return Endge.domain.getIntegration(id)?.name ?? id
    if (key === 'environment')
      return Endge.domain.getEnvironment(id)?.name ?? id
    if (key === 'tenant') {
      const tenant = Endge.domain.getTenant(id)
      return tenant?.displayName ?? tenant?.name ?? id
    }
    if (key === 'policy')
      return Endge.domain.getPolicy(id)?.name ?? id
    if (key === 'style')
      return Endge.domain.getStyle(id)?.name ?? id
    if (key === 'view')
      return Endge.domain.getView(id)?.name ?? id
    if (key === 'vocabs')
      return Endge.domain.getVocab(id)?.displayName ?? Endge.domain.getVocab(id)?.name ?? id
    if (key === 'auth-profile')
      return Endge.domain.getAuthProfile(id)?.displayName ?? Endge.domain.getAuthProfile(id)?.name ?? id
    if (key === 'i18n-bundles')
      return Endge.domain.getI18nBundle(id)?.displayName ?? Endge.domain.getI18nBundle(id)?.name ?? id
    if (key === 'page-template')
      return Endge.domain.getPageTemplate(id)?.name ?? id
    if (key === 'page')
      return Endge.domain.getPage(id)?.name ?? id
    if (key === 'navigation')
      return Endge.domain.getNavigation(id)?.name ?? id
    if (key === 'project') {
      const project = Endge.domain.getProject(id)
      return project?.displayName ?? project?.name ?? id
    }
    return id
  }

  public getDocumentIcon(docType: DomainDocumentType, presentationKind?: string): string {
    const key = String(docType)
    if (key === String(ComponentType.Table))
      return 'ti ti-table text-green-500 text-xl'
    if (key === String(ComponentType.DSL))
      return 'ti ti-file-type-jsx text-purple-500 text-xl'
    if (key === String(COMPONENT_SFC_TYPE))
      return 'ti ti-file-type-tsx text-cyan-500 text-xl'
    if (isQueryDocumentType(key))
      return 'ti ti-api text-orange-500 text-xl'
    if (key === 'data-view')
      return 'ti ti-braces text-cyan-500 text-xl'
    if (key === 'composition')
      return presentationKind === QUERY_COMPOSITION_PRESENTATION_KIND
        ? 'ti ti-topology-star-3 text-orange-500 text-xl'
        : 'ti ti-topology-star-3 text-violet-500 text-xl'
    if (key === 'store')
      return 'ti ti-database text-emerald-500 text-xl'
    if (key === 'mock')
      return 'ti ti-braces text-[#8B5A2B] dark:text-[#C08A52] text-xl'
    if (key === String(ParameterType.DefaultParameter))
      return 'ti ti-form-input text-slate-500 text-xl'
    if (key === String(FilterType.DefaultFilter))
      return 'ti ti-filter text-blue-500 text-xl'
    if (key === 'primitive')
      return 'ti ti-box-padding text-pink-500 text-xl'
    if (key === 'type')
      return 'ti ti-box-multiple text-rose-500 text-xl'
    if (key === 'action')
      return 'ti ti-function text-blue-500 text-2xl'
    if (key === 'converter')
      return 'ti ti-exchange text-blue-500 text-2xl'
    if (key === 'integration')
      return 'ti ti-plug text-violet-500 text-2xl'
    if (key === 'environment')
      return 'ti ti-bolt text-lime-500 text-2xl'
    if (key === 'tenant')
      return 'ti ti-building-community text-emerald-500 text-2xl'
    if (key === 'policy')
      return 'ti ti-shield text-sky-500 text-2xl'
    if (key === 'style')
      return 'ti ti-palette text-fuchsia-500 text-2xl'
    if (key === 'view')
      return 'ti ti-eye text-indigo-500 text-2xl'
    if (key === 'vocabs')
      return 'ti ti-book text-teal-500 text-2xl'
    if (key === 'auth-profile')
      return 'ti ti-key text-sky-500 text-2xl'
    if (key === 'i18n-bundles')
      return 'ti ti-language text-amber-500 text-2xl'
    if (key === 'page-template')
      return 'ti ti-layout-navbar text-emerald-500 text-2xl'
    if (key === 'page')
      return 'ti ti-layout-board text-indigo-500 text-2xl'
    if (key === 'navigation')
      return 'ti ti-route text-cyan-500 text-2xl'
    if (key === 'project')
      return 'ti ti-briefcase text-sky-500 text-2xl'
    return 'ti ti-file-alert text-xl text-red-500'
  }

  /** Обновляет icon metadata Mock-вкладок, восстановленных из localStorage. */
  private _refreshPersistedMockTabIcons(): void {
    for (const tab of this.openTabs.value) {
      if (tab.viewId !== VIEW_ID_DOCUMENT) {
        continue
      }
      const payload = this._getPayload<DocumentTabPayload>(tab.payload)
      if (!payload || String(payload.documentType) !== 'mock') {
        continue
      }
      tab.meta = {
        ...tab.meta,
        icon: this.getDocumentIcon(payload.documentType),
      }
    }
  }

  private _registerSystemViews(): void {
    const wrap = (tab: SmartTabRef): SmartTabViewResolved => ({
      component: markRaw(TabContentWrapper),
      props: { tab },
    })
    registerSmartTabView(VIEW_ID_DOCUMENT, wrap)
    registerSmartTabView(VIEW_ID_WORKSPACE_SETTINGS, (): SmartTabViewResolved => ({
      component: markRaw(Workspace_Editor),
      props: {},
    }))
    registerSmartTabView(VIEW_ID_VERSION, wrap)
    registerSmartTabView(VIEW_ID_VIEW_GENERATOR, (): SmartTabViewResolved => ({
      component: markRaw(ViewGenerator_Editor),
      props: {},
    }))
    registerSmartTabView(VIEW_ID_DSL_PLAYGROUND, (): SmartTabViewResolved => ({
      component: markRaw(DSL_Playground_Widget),
      props: {},
    }))
    registerSmartTabView(VIEW_ID_SFC_PLAYGROUND, (): SmartTabViewResolved => ({
      component: markRaw(SFC_Playground_Widget),
      props: {},
    }))
    registerSmartTabView(VIEW_ID_ACTION_PLAYGROUNDS, (): SmartTabViewResolved => ({
      component: markRaw(ActionPlaygrounds_Singleton),
      props: {},
    }))
    registerSmartTabView(VIEW_ID_BACKUP_RESTORE, (): SmartTabViewResolved => ({
      component: markRaw(BackupRestore_Singleton),
      props: {},
    }))
    registerSmartTabView(VIEW_ID_UI_EDITOR_DEMO, (): SmartTabViewResolved => ({
      component: markRaw(UIEditorDemo_Singleton),
      props: {},
    }))
    registerSmartTabView(VIEW_ID_DEMONSTRATION, (): SmartTabViewResolved => ({
      component: markRaw(DemonstrationTab_View),
      props: {},
    }))
    registerSmartTabView(VIEW_ID_PULSE, (): SmartTabViewResolved => ({
      component: markRaw(Pulse_Tab),
      props: {},
    }))
    registerSmartTabView(VIEW_ID_ARCHITECTURE, (): SmartTabViewResolved => ({
      component: markRaw(Architecture_Tab),
      props: {},
    }))
    registerSmartTabView(VIEW_ID_DOMAIN_ANALYSIS, (): SmartTabViewResolved => ({
      component: markRaw(Domain_Analysis_Tab),
      props: {},
    }))
    registerSmartTabView(VIEW_ID_RUNTIME_DEBUG, (tab: SmartTabRef): SmartTabViewResolved => {
      const raw = (tab.payload ?? null) as unknown
      const payload = raw && typeof raw === 'object'
        ? raw as RuntimeDebugTabPayload
        : null
      return {
        component: markRaw(Runtime_Debug_Tab),
        props: {
          tabContext: {
            debugTab: payload,
          },
        },
      }
    })
  }

  private _registerDocsView(): void {
    registerSmartTabView(DOCS_VIEW_ID, (tab: SmartTabRef): SmartTabViewResolved => {
      const payload = tab.payload as unknown as DocsTabPayload | undefined
      const file = payload?.file
      const title = payload?.title ?? 'Документация'
      if (!file) {
        return {
          component: defineComponent({
            name: 'EndgeDocsTabEmpty',
            setup: () => () => h('div', { class: 'p-4 text-sm text-muted-foreground' }, 'Нет данных'),
          }),
          props: {},
        }
      }
      return {
        component: defineComponent({
          name: 'EndgeDocsTab',
          setup: () => () =>
            h('div', { class: 'p-4 docs-tab-content h-full overflow-auto' }, [
              h('h1', { class: 'text-lg font-bold mb-3' }, title),
              h(MarkdownViewer, { src: file }),
            ]),
        }),
        props: {},
      }
    })
  }

  private _resolveDocumentTab(tab: SmartTabRef): SmartTabViewResolved | null {
    const payload = this._getPayload<DocumentTabPayload>(tab.payload)
    const documentId = payload?.documentId
    const documentType = payload?.documentType
    if (!documentId || !documentType)
      return null
    const cached = this._sessionByTabId.get(tab.id)
    if (cached) {
      this._setCurrentFromSession(cached)
      return cached.view
    }
    const resolver = this._getDocResolver(documentType)
    const session = resolver?.(documentId) ?? null
    if (!session)
      return null
    this._sessionByTabId.set(tab.id, session)
    this._setCurrentFromSession(session)
    return session.view
  }

  private _resolveVersionTab(tab: SmartTabRef): SmartTabViewResolved | null {
    const payload = this._getPayload<VersionTabPayload>(tab.payload)
    const versionId = payload?.versionId
    if (!versionId)
      return null
    const version = Endge.domain.getVersion(versionId)
    if (!version)
      return null
    const session: EditorSession = {
      view: { component: markRaw(Version_Editor), props: { tabContext: { version } } },
      editor: null,
      model: version,
    }
    this._sessionByTabId.set(tab.id, session)
    this._setCurrentFromSession(session)
    return session.view
  }

  private _getDocResolver(docType: DomainDocumentType): DocResolver | null {
    return this._docResolvers.get(String(docType)) ?? null
  }

  private readonly _docResolvers: Map<string, DocResolver> = new Map([
    [String(ComponentType.Table), (documentId) => this._resolveComponentTable(documentId)],
    [String(ComponentType.DSL), (documentId) => this._resolveComponentDSL(documentId)],
    [String(COMPONENT_SFC_TYPE), (documentId) => this._resolveComponentSFC(documentId)],
    [String(QueryType.REST), (documentId) => this._resolveQuery(documentId)],
    [String(QueryType.GraphQL), (documentId) => this._resolveQuery(documentId)],
    [String(QueryType.Custom), (documentId) => this._resolveQuery(documentId)],
    ['data-view', (documentId) => this._resolveDataView(documentId)],
    ['composition', (documentId) => this._resolveComposition(documentId)],
    ['store', (documentId) => this._resolveStore(documentId)],
    ['mock', (documentId) => this._resolveMock(documentId)],
    ['action', (documentId) => this._resolveAction(documentId)],
    [String(ParameterType.DefaultParameter), (documentId) => this._resolveParameter(documentId)],
    [String(FilterType.DefaultFilter), (documentId) => this._resolveFilter(documentId)],
    ['converter', (documentId) => this._resolveConverter(documentId)],
    ['integration', (documentId) => this._resolveIntegration(documentId)],
    ['environment', (documentId) => this._resolveEnvironment(documentId)],
    ['tenant', (documentId) => this._resolveTenant(documentId)],
    ['policy', (documentId) => this._resolvePolicy(documentId)],
    ['style', (documentId) => this._resolveStyle(documentId)],
    ['vocabs', (documentId) => this._resolveVocabs(documentId)],
    ['auth-profile', (documentId) => this._resolveAuthProfile(documentId)],
    ['i18n-bundles', (documentId) => this._resolveI18nBundle(documentId)],
    ['view', (documentId) => this._resolveView(documentId)],
    ['page-template', (documentId) => this._resolvePageTemplate(documentId)],
    ['page', (documentId) => this._resolvePage(documentId)],
    ['navigation', (documentId) => this._resolveNavigation(documentId)],
    ['project', (documentId) => this._resolveProject(documentId)],
    ['type', (documentId) => this._resolveType(documentId)],
  ])

  private _resolveComponentTable(documentId: string): EditorSession | null {
    const component = Endge.domain.getComponent(documentId) as RComponentTable | null
    if (!component)
      return null
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
        if (typeof (editor as unknown as { updateSource?: (m: unknown) => void }).updateSource === 'function')
          (editor as unknown as { updateSource: (m: unknown) => void }).updateSource(component)
      },
    }
  }

  private _resolveComponentDSL(documentId: string): EditorSession | null {
    const component = Endge.domain.getComponent(documentId) as RComponentDSL | null
    if (!component)
      return null
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
        if (typeof (editor as unknown as { updateSource?: (m: unknown) => void }).updateSource === 'function')
          (editor as unknown as { updateSource: (m: unknown) => void }).updateSource(component)
      },
    }
  }

  private _resolveComponentSFC(documentId: string): EditorSession | null {
    const component = (Endge.domain as any).getComponentSFC?.(documentId) ?? null
    if (!component)
      return null
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
    if (!rType || rType.isPrimitive)
      return null
    const editor = new RTypeEditor()
    editor.fillFromSource(rType)
    return {
      view: { component: markRaw(Type_Editor), props: { tabContext: { editor } } },
      editor,
      model: rType,
      syncBeforeSave: () => {
        if (typeof (editor as unknown as { updateSource?: (m: unknown) => void }).updateSource === 'function')
          (editor as unknown as { updateSource: (m: unknown) => void }).updateSource(rType)
      },
    }
  }

  private _resolveAction(documentId: string): EditorSession | null {
    const action = Endge.domain.getAction(documentId) as RAction | null
    if (!action)
      return null
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
    if (!query)
      return null
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
    if (!dataView)
      return null
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
    if (!composition)
      return null
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

  private _resolveStore(documentId: string): EditorSession | null {
    const store = Endge.domain.getStore(documentId) as RStore | null
    if (!store)
      return null
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

  private _resolveMock(documentId: string): EditorSession | null {
    const mock = Endge.domain.getMock(documentId) as RMock | null
    if (!mock)
      return null
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

  private _resolveParameter(documentId: string): EditorSession | null {
    const parameter = Endge.domain.getParameter(documentId)
    if (!parameter)
      return null
    const editor = new RParameterEditor()
    editor.fillFromSource(parameter)
    return {
      view: {
        component: markRaw(FiltersPanel_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: parameter,
      syncBeforeSave: () => editor.updateSource(parameter),
    }
  }

  private _resolveFilter(documentId: string): EditorSession | null {
    const filter = Endge.domain.getFilter(documentId)
    if (!filter)
      return null
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
    if (!converter)
      return null
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

  private _resolveIntegration(documentId: string): EditorSession | null {
    const integration = Endge.domain.getIntegration(documentId)
    if (!integration)
      return null
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

  private _resolveEnvironment(documentId: string): EditorSession | null {
    const environment = Endge.domain.getEnvironment(documentId)
    if (!environment)
      return null
    const editor = new REnvironmentEditor()
    editor.fillFromSource(environment)
    return {
      view: {
        component: markRaw(Environment_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: environment,
      syncBeforeSave: () => editor.updateSource(environment),
    }
  }

  private _resolveTenant(documentId: string): EditorSession | null {
    const tenant = Endge.domain.getTenant(documentId) as RTenant | null
    if (!tenant)
      return null
    const editor = new RTenantEditor()
    editor.fillFromSource(tenant)
    return {
      view: {
        component: markRaw(Tenant_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: tenant,
      syncBeforeSave: () => editor.updateSource(tenant),
    }
  }

  private _resolvePolicy(documentId: string): EditorSession | null {
    const policy = Endge.domain.getPolicy(documentId)
    if (!policy)
      return null
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
    if (!style)
      return null
    const editor = new RStyleEditor()
    editor.fillFromSource(style)
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

  private _resolveVocabs(documentId: string): EditorSession | null {
    const vocab = Endge.domain.getVocab(documentId)
    if (!vocab)
      return null
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
    if (!profile)
      return null
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
    if (!bundle)
      return null
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
    if (!tpl)
      return null
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
    if (!page)
      return null
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
    if (!nav)
      return null
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

  private _resolveView(documentId: string): EditorSession | null {
    const view = Endge.domain.getView(documentId)
    if (!view)
      return null
    const editor = new RViewEditor()
    editor.fillFromSource(view)
    return {
      view: {
        component: markRaw(View_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: view,
      syncBeforeSave: () => editor.updateSource(view),
    }
  }

  private _resolveProject(documentId: string): EditorSession | null {
    const project = Endge.domain.getProject(documentId)
    if (!project)
      return null
    const rawEditor = new RProjectEditor()
    rawEditor.fillFromSource(project)
    const editor = reactive(rawEditor as object) as RProjectEditor
    return {
      view: {
        component: markRaw(Project_Editor),
        props: { tabContext: { editor } },
      },
      editor,
      model: project,
      syncBeforeSave: () => editor.updateSource(project),
    }
  }

  private _setCurrentFromSession(session: EditorSession): void {
    this.documentEditorModel.value = session.editor != null ? reactive(session.editor as object) : null
    this.documentModel.value = session.model ?? null
  }

  /** Синхронизирует контекст инспектора с сессией вкладки (чтобы инспектор отображал данные активной вкладки). */
  public syncContextForTab(tab: SmartTabRef | null): void {
    if (!tab) return
    const session = this._sessionByTabId.get(tab.id)
    if (session)
      this._setCurrentFromSession(session)
  }

  private _syncContextForTab(tab: SmartTabRef): void {
    this.syncContextForTab(tab)
  }

  private _getPayload<T>(payload: unknown): T | null {
    if (!payload || typeof payload !== 'object')
      return null
    return payload as T
  }

  private _resolveSaveDocumentId(
    documentType: DomainDocumentType,
    fallbackId: string,
    model: unknown,
  ): string {
    if (documentType !== 'page')
      return fallbackId
    if (Endge.domain.getPage(fallbackId))
      return fallbackId
    if (!model || typeof model !== 'object')
      return fallbackId
    const identity = (model as { identity?: unknown }).identity
    if (typeof identity !== 'string')
      return fallbackId
    const normalized = identity.trim()
    return normalized || fallbackId
  }

  private async _syncBindingsEditorState(
    documentType: DomainDocumentType,
    editor: unknown,
  ): Promise<void> {
    void documentType
    const state = getBehaviorBindingEditorState(editor)
    if (!state)
      return

    const ownerType = String(state.ownerType ?? '').trim().toLowerCase()
    const ownerId = Number(state.ownerId)
    if (!ownerType || !Number.isFinite(ownerId))
      return

    await Endge.schema.syncOwnerBehaviorBindings({
      ownerType,
      ownerId,
      targetType: state.targetType ?? ownerType,
      targetId: Number.isFinite(Number(state.targetId)) ? Number(state.targetId) : ownerId,
      projectId: state.projectId ?? null,
      items: state.items ?? [],
    })
  }

  private async _syncPresentationBindingsEditorState(
    documentType: DomainDocumentType,
    editor: unknown,
  ): Promise<void> {
    void documentType
    const state = getPresentationBindingEditorState(editor)
    if (!state)
      return

    const ownerType = String(state.ownerType ?? '').trim().toLowerCase()
    const ownerId = Number(state.ownerId)
    if (!ownerType || !Number.isFinite(ownerId))
      return

    await Endge.schema.syncOwnerPresentationBindings({
      ownerType,
      ownerId,
      targetType: state.targetType ?? ownerType,
      targetId: Number.isFinite(Number(state.targetId)) ? Number(state.targetId) : ownerId,
      projectId: state.projectId ?? null,
      items: state.items ?? [],
    })
  }
}
