/**
 * Сериализуемый action заголовка для обмена с iframe.
 * Иконка передаётся строкой с именем из lucide-vue-next.
 */
export interface SerializableWidgetHeaderAction {
  readonly id: string
  readonly title?: string
  readonly icon?: string
  order?: number
  disabled?: boolean
}

/**
 * Composable для обмена содержимого iframe с родительским контейнером виджета.
 * Работает как для встроенного в основной layout виджета, так и для popup.
 *
 * Пример использования внутри iframe:
 * ```ts
 * const { setTitle, setLoading, addHeaderAction } = useWidgetIframe()
 *
 * // Обновление заголовка виджета
 * setTitle('Flight #123 Details')
 *
 * // Отображение или скрытие состояния загрузки
 * setLoading(true)
 *
 * // Добавление пользовательского action в заголовок
 * addHeaderAction({
 *   id: 'refresh',
 *   title: 'Refresh',
 *   icon: RefreshCw,
 *   onClick: () => fetchData()
 * })
 * ```
 */
export function useWidgetIframe() {
  function postToParent(type: string, data: Record<string, unknown>) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type, ...data }, '*')
    }
  }

  function setTitle(title: string) {
    postToParent('widget-update-title', { title })
  }

  function setLoading(isLoading: boolean) {
    postToParent('widget-update-loading', { isLoading })
  }

  function setHeaderActions(headerActions: {
    header?: SerializableWidgetHeaderAction[]
    options?: SerializableWidgetHeaderAction[]
  }) {
    postToParent('widget-update-header-actions', { headerActions })
  }

  function addHeaderAction(action: SerializableWidgetHeaderAction, location: 'header' | 'options' = 'header') {
    postToParent('widget-add-header-action', { action, location })
  }

  function removeHeaderAction(actionId: string) {
    postToParent('widget-remove-header-action', { actionId })
  }

  function triggerAction(actionId: string) {
    postToParent('widget-trigger-action', { actionId })
  }

  return {
    setTitle,
    setLoading,
    setHeaderActions,
    addHeaderAction,
    removeHeaderAction,
    triggerAction,
  }
}
