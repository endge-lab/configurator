import { Endge } from '@endge/core'
import { computed, defineAsyncComponent, markRaw } from 'vue'

import {
  createWidgetInstance,
  getAreaActiveWidget,
  getAreaExpanded,
  getLayoutState,
  getWidget,
  getWidgetInstances,
  getWidgetOrder,
  migratePersistedWidgetId,
  registerWidget,
  removePersistedWidgetId,
  reorderWidget,
  setAreaActiveWidget,
  setAreaExpanded,
  setLayoutScope,
  setWidgetVisibility,
  unregisterAllWidgets,
} from '@/components/layouts/grid/layout'
import { endgeIDEWidgetsConfig } from '@/features/endge-ide/config/widgets.ts'
import {
  ENDGE_IDE_DOMAIN_WIDGET_ID,
  LEGACY_ENDGE_IDE_DOMAIN_WIDGET_ID,
} from '@/features/endge-ide/domain/types/domain-workspace.types'
import { ENDGE_IDE_PROBLEMS_WIDGET_ID } from '@/features/endge-ide/domain/types/problems-workspace.types'
import {
  ENDGE_IDE_RUNTIME_TREE_WIDGET_ID,
  LEGACY_ENDGE_PREVIEW_WIDGET_ID,
} from '@/features/endge-ide/domain/types/runtime-preview.types'

type DockablePosition = 'left' | 'right' | 'bottom'

/**
 * EndgeIDEWidgets
 *
 * Поведение:
 * - activeWidget восстанавливается из Endge context state
 * - expanded (состояние области) восстанавливается из Endge context state
 * - singleton-инстансы создаются, но:
 *   - НЕ активируются, если область свернута (expanded=false)
 *   - НЕ перетирают activeWidget при наличии persistedActive
 */
export class EndgeIDEWidgets_Module {
  private _widgetDefinitions = endgeIDEWidgetsConfig
  private _isInitialized = false

  /** Проекция видимости зарегистрированных виджетов из состояния layout. */
  private readonly _layoutWidgets = getLayoutState().widgets
  private readonly _visibilityItems = computed(() => {
    const state = this._layoutWidgets.value
    return Object.values(state.definitions).map(widget => ({
      id: widget.id,
      title: widget.title,
      icon: widget.icon,
      iconClass: widget.iconClass,
      visible: !widget.hidden && getWidgetInstances(widget.id).length > 0,
    } as const))
  })

  /** Возвращает реактивные пункты меню без отдельного состояния видимости. */
  public get visibilityItems() {
    return this._visibilityItems
  }

  /** Показывает или скрывает кнопку виджета без переключения активной вкладки. */
  public toggleVisibility(definitionId: string): void {
    const widget = getWidget(definitionId)
    if (!widget) {
      return
    }
    if (getWidgetInstances(definitionId).length === 0) {
      createWidgetInstance(definitionId, {}, { activate: false })
      setWidgetVisibility(definitionId, true)
      return
    }
    setWidgetVisibility(definitionId, widget.hidden)
  }

  /**
   * LIFECYCLE
   */
  public init(): void {
    if (this._isInitialized) {
      return
    }

    const debuggerMode = Endge.mode === 'debugger'
    if (debuggerMode) {
      setLayoutScope('debugger')
    }
    else {
      migratePersistedWidgetId(LEGACY_ENDGE_PREVIEW_WIDGET_ID, ENDGE_IDE_RUNTIME_TREE_WIDGET_ID)
      migratePersistedWidgetId(LEGACY_ENDGE_IDE_DOMAIN_WIDGET_ID, ENDGE_IDE_DOMAIN_WIDGET_ID)
      removePersistedWidgetId('help')
      removePersistedWidgetId('inspector')
      removePersistedWidgetId('errors')
      removePersistedWidgetId('pulse')
    }
    const definitions = debuggerMode
      ? this._widgetDefinitions.filter(def => def.id === ENDGE_IDE_DOMAIN_WIDGET_ID || def.id === ENDGE_IDE_RUNTIME_TREE_WIDGET_ID).map(def => ({
          ...def,
          ...(def.id === ENDGE_IDE_RUNTIME_TREE_WIDGET_ID ? { defaultComponent: markRaw(defineAsyncComponent(() => import('@/features/endge-ide/ui/widgets/RuntimeInspection_Widget.vue'))) } : {}),
          allowedPositions: ['left' as const],
          floatingConstraints: undefined,
          permanent: true,
        }))
      : this._widgetDefinitions

    // 1) Регистрируем виджеты (внутри registerWidget подхватываются позиции/expanded/activeWidget)
    definitions.forEach(def => registerWidget(def))
    if (!debuggerMode) {
      this._ensureWorkspaceDefaultOrder()
    }

    // 2) Снимаем persisted-состояния ДО создания инстансов
    const persistedActive: Record<DockablePosition, string | null> = {
      left: getAreaActiveWidget('left'),
      right: getAreaActiveWidget('right'),
      bottom: getAreaActiveWidget('bottom'),
    }

    const persistedExpanded: Record<DockablePosition, boolean> = {
      left: getAreaExpanded('left'),
      right: getAreaExpanded('right'),
      bottom: getAreaExpanded('bottom'),
    }

    // 3) Создаём singleton-инстансы без “насильного открытия” областей
    definitions.forEach((def) => {
      if (!def.singleton) {
        return
      }

      const widget = getWidget(def.id)
      const position = (widget?.position ?? def.defaultPosition ?? 'left')

      if (widget?.hidden) {
        createWidgetInstance(def.id, {}, { activate: false })
        return
      }

      if (position === 'floating' || position === 'popup') {
        // Для floating/popup expanded не применим - создаём как обычно
        createWidgetInstance(def.id, {})
        return
      }

      const dockPos: DockablePosition = position

      // Если область свернута - НЕ активируем виджет (иначе showWidget откроет область)
      if (!persistedExpanded[dockPos]) {
        createWidgetInstance(def.id, {}, { activate: false })
        return
      }

      // Если область развернута:
      // - если persistedActive отсутствует, можно активировать первый попавшийся singleton
      // - если persistedActive есть - активируем только его, остальные создаём без активации
      const targetActive = persistedActive[dockPos]
      const shouldActivate: boolean = !targetActive || targetActive === def.id

      createWidgetInstance(def.id, {}, { activate: shouldActivate })
    })

    // 4) Финально применяем persisted active/expanded обратно (на случай порядка регистрации/создания)
    setAreaActiveWidget('left', persistedActive.left)
    setAreaActiveWidget('right', persistedActive.right)
    setAreaActiveWidget('bottom', persistedActive.bottom)

    setAreaExpanded('left', persistedExpanded.left)
    setAreaExpanded('right', persistedExpanded.right)
    setAreaExpanded('bottom', persistedExpanded.bottom)

    if (debuggerMode) {
      setAreaActiveWidget('left', ENDGE_IDE_DOMAIN_WIDGET_ID)
      setAreaExpanded('left', true)
    }
    this._isInitialized = true
  }

  /** Оставляет Runtime Tree рядом с Domain, а Problems — последним левым widget. */
  private _ensureWorkspaceDefaultOrder(): void {
    const order = getWidgetOrder('left')
    const domainIndex = order.indexOf(ENDGE_IDE_DOMAIN_WIDGET_ID)
    const previewIndex = order.indexOf(ENDGE_IDE_RUNTIME_TREE_WIDGET_ID)
    if (domainIndex >= 0 && previewIndex !== domainIndex + 1 && previewIndex === order.length - 1) {
      const nextWidgetId = order[domainIndex + 1]
      if (nextWidgetId) {
        reorderWidget(ENDGE_IDE_RUNTIME_TREE_WIDGET_ID, nextWidgetId, 'left')
      }
    }

    const normalizedOrder = getWidgetOrder('left')
    const problemsIndex = normalizedOrder.indexOf(ENDGE_IDE_PROBLEMS_WIDGET_ID)
    if (problemsIndex < 0 || problemsIndex === normalizedOrder.length - 1) {
      return
    }

    for (const widgetId of normalizedOrder.slice(problemsIndex + 1)) {
      reorderWidget(widgetId, ENDGE_IDE_PROBLEMS_WIDGET_ID, 'left')
    }
  }

  /**
   * LIFECYCLE
   */
  public reset(): void {
    unregisterAllWidgets()
    this._isInitialized = false
  }
}
