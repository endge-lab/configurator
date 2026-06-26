import type { SmartTabRef } from '@/components/ui/smart-tabs/types.ts'
import type { Component } from 'vue'
import type { DomainDocumentType } from '@endge/core'

import { ComponentType, QueryType, ScriptType, FilterType, ParameterType } from '@endge/core'
import { markRaw } from 'vue'

import { showWidget } from '@/components/layouts/grid'
import type { EndgeAdminTabs } from '@/features/endge-admin/model/core/endge-admin-tabs.ts'
import CustomInspector from '@/features/endge-admin/ui/section/inspectors/Custom_Inspector.vue'
import DslInspector from '@/features/endge-admin/ui/section/inspectors/DSL_Inspector.vue'
import ActionInspector from '@/features/endge-admin/ui/section/inspectors/Action_Inspector.vue'
import ConverterInspector from '@/features/endge-admin/ui/section/inspectors/Converter_Inspector.vue'
import IntegrationInspector from '@/features/endge-admin/ui/section/inspectors/Integration_Inspector.vue'
import EnvironmentInspector from '@/features/endge-admin/ui/section/inspectors/Environment_Inspector.vue'
import TenantInspector from '@/features/endge-admin/ui/section/inspectors/Tenant_Inspector.vue'
import PolicyInspector from '@/features/endge-admin/ui/section/inspectors/Policy_Inspector.vue'
import StyleInspector from '@/features/endge-admin/ui/section/inspectors/Style_Inspector.vue'
import VocabsInspector from '@/features/endge-admin/ui/section/inspectors/Vocabs_Inspector.vue'
import I18nBundlesInspector from '@/features/endge-admin/ui/section/inspectors/I18nBundles_Inspector.vue'
import ViewInspector from '@/features/endge-admin/ui/section/inspectors/View_Inspector.vue'
import FilterInspector from '@/features/endge-admin/ui/section/inspectors/Filter_Inspector.vue'
import ParameterInspector from '@/features/endge-admin/ui/section/inspectors/Parameter_Inspector.vue'
import GraphQlInspector from '@/features/endge-admin/ui/section/inspectors/GraphQL_Inspector.vue'
import RestInspector from '@/features/endge-admin/ui/section/inspectors/Rest_Inspector.vue'
import ScenarioInspector from '@/features/endge-admin/ui/section/inspectors/Scenario_Inspector.vue'
import TableInspector from '@/features/endge-admin/ui/section/inspectors/Table_Inspector.vue'
import TypeInspector from '@/features/endge-admin/ui/section/inspectors/Type_Inspector.vue'
import PageInspector from '@/features/endge-admin/ui/section/inspectors/Page_Inspector.vue'
import PageTemplateInspector from '@/features/endge-admin/ui/section/inspectors/PageTemplate_Inspector.vue'
import NavigationInspector from '@/features/endge-admin/ui/section/inspectors/Navigation_Inspector.vue'
import ProjectInspector from '@/features/endge-admin/ui/section/inspectors/Project_Inspector.vue'
import SettingsInspector from '@/features/endge-admin/ui/section/inspectors/Settings_Inspector.vue'
import UIEditorDemoInspector from '@/features/endge-admin-ui-editor/UI/UIEditorDemoInspector.vue'

const INSPECTOR_WIDGET_ID = 'inspector'

export type InspectorView = { component: Component; props: Record<string, unknown> }

/**
 * Модуль инспектора: регистратор компонентов по типу документа, разрешение контекста, активация виджета.
 */
export class EndgeAdminInspector {
  public init(): void {}
  public reset(): void {}

  /**
   * Компонент инспектора для вкладки (по payload.documentType).
   */
  public getComponentForTab(tab: SmartTabRef | null): Component | null {
    if (!tab) return null
    const byViewId = this._viewRegistry.get(String(tab.viewId ?? ''))
    if (byViewId) return byViewId
    const payload = tab.payload as { documentType?: DomainDocumentType } | undefined
    const documentType = payload?.documentType
    if (!documentType) return null
    return this._registry.get(documentType) ?? null
  }

  /**
   * View для активного документа: компонент инспектора + контекст текущего документа.
   * Контекст документа и инспектора один и тот же (document.getCurrentContext).
   */
  public getViewForTab(tab: SmartTabRef | null, tabs: EndgeAdminTabs): InspectorView | null {
    if (!tab) return null
    const byViewId = this._viewRegistry.get(String(tab.viewId ?? ''))
    if (byViewId) {
      return {
        component: byViewId,
        props: {},
      }
    }
    tabs.syncContextForTab(tab)
    const ctx = tabs.getCurrentContext()
    const component = this.getComponentForTab(tab)
    if (!ctx || !component) return null
    return {
      component,
      props: { tabContext: ctx },
    }
  }

  /** Регистратор: documentType - компонент инспектора */
  private _registry = new Map<DomainDocumentType | string, Component>([
    [ComponentType.DSL, markRaw(DslInspector)],
    [ComponentType.Table, markRaw(TableInspector)],
    [ScriptType.ScenarioSetup, markRaw(ScenarioInspector)],
    [QueryType.GraphQL, markRaw(GraphQlInspector)],
    [QueryType.REST, markRaw(RestInspector)],
    [QueryType.Custom, markRaw(CustomInspector)],
    ['action', markRaw(ActionInspector)],
    ['primitive', markRaw(TypeInspector)],
    ['type', markRaw(TypeInspector)],
    [ParameterType.DefaultParameter, markRaw(ParameterInspector)],
    [FilterType.DefaultFilter, markRaw(FilterInspector)],
    ['converter', markRaw(ConverterInspector)],
    ['integration', markRaw(IntegrationInspector)],
    ['environment', markRaw(EnvironmentInspector)],
    ['tenant', markRaw(TenantInspector)],
    ['policy', markRaw(PolicyInspector)],
    ['style', markRaw(StyleInspector)],
    ['vocabs', markRaw(VocabsInspector)],
    ['i18n-bundles', markRaw(I18nBundlesInspector)],
    ['view', markRaw(ViewInspector)],
    ['page', markRaw(PageInspector)],
    ['page-template', markRaw(PageTemplateInspector)],
    ['navigation', markRaw(NavigationInspector)],
    ['project', markRaw(ProjectInspector)],
    ['settings', markRaw(SettingsInspector)],
  ])

  /** Регистратор singleton/view-based inspector views. */
  private _viewRegistry = new Map<string, Component>([
    ['endge-ui-editor-demo', markRaw(UIEditorDemoInspector)],
  ])

  /** Перевести фокус на виджет инспектора (показать и активировать). */
  public activate(): void {
    showWidget(INSPECTOR_WIDGET_ID)
  }
}
