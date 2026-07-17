import {
  createWidgetInstance,
  getAreaActiveWidget,
  getAreaExpanded,
  getWidget,
  getWidgetOrder,
  hideWidget,
  migratePersistedWidgetId,
  registerWidget,
  reorderWidget,
  setAreaActiveWidget,
  setAreaExpanded,
  unregisterAllWidgets,
} from '@/components/layouts/grid'
import { endgeIDEWidgetsConfig } from '@/features/endge-ide/config/widgets.ts'
import {
  ENDGE_IDE_RUNTIME_TREE_WIDGET_ID,
  LEGACY_ENDGE_PREVIEW_WIDGET_ID,
} from '@/features/endge-ide/domain/types/runtime-preview.types'

type DockablePosition = 'left' | 'right' | 'bottom'

/**
 * EndgeIDEWidgets
 *
 * Поведение:
 * - activeWidget восстанавливается из localStorage
 * - expanded (состояние области) восстанавливается из localStorage
 * - singleton-инстансы создаются, но:
 *   - НЕ активируются, если область свернута (expanded=false)
 *   - НЕ перетирают activeWidget при наличии persistedActive
 */
export class EndgeIDEWidgets {
  private _widgetDefinitions = endgeIDEWidgetsConfig
  private _isInitialized = false

  /**
   * LIFECYCLE
   */
  public init(): void {
    if (this._isInitialized) {
      return
    }

    migratePersistedWidgetId(LEGACY_ENDGE_PREVIEW_WIDGET_ID, ENDGE_IDE_RUNTIME_TREE_WIDGET_ID)

    // 1) Регистрируем виджеты (внутри registerWidget подхватываются позиции/expanded/activeWidget)
    this._widgetDefinitions.forEach(def => registerWidget(def))
    this._ensureRuntimePreviewDefaultOrder()

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
    this._widgetDefinitions.forEach((def) => {
      if (!def.singleton) {
        return
      }

      const widget = getWidget(def.id)
      const position = (widget?.position ?? def.defaultPosition ?? 'left')

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

    // Виджет «Демонстрация» по умолчанию скрыт (minimized)
    hideWidget('demonstration')
    hideWidget('sfc-preview')
    hideWidget('composition-preview')

    this._isInitialized = true
  }

  /** Places a newly appended Preview widget after Project without overwriting a custom order. */
  private _ensureRuntimePreviewDefaultOrder(): void {
    const order = getWidgetOrder('left')
    const projectIndex = order.indexOf('project')
    const previewIndex = order.indexOf(ENDGE_IDE_RUNTIME_TREE_WIDGET_ID)
    if (projectIndex < 0 || previewIndex === projectIndex + 1 || previewIndex !== order.length - 1) {
      return
    }
    const nextWidgetId = order[projectIndex + 1]
    if (nextWidgetId) {
      reorderWidget(ENDGE_IDE_RUNTIME_TREE_WIDGET_ID, nextWidgetId, 'left')
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
