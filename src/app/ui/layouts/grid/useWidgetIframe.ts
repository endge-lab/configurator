/**
 * Serializable header action for iframe communication.
 * Icon is passed as a string (icon name from lucide-vue-next).
 */
export interface SerializableWidgetHeaderAction {
  readonly id: string
  readonly title?: string
  readonly icon?: string
  order?: number
  disabled?: boolean
}

/**
 * Composable for iframe content to communicate with its parent widget container.
 * Works both when the widget is embedded in the main layout and when opened as a popup.
 *
 * Usage in iframe content:
 * ```ts
 * const { setTitle, setLoading, addHeaderAction } = useWidgetIframe()
 *
 * // Update widget title
 * setTitle('Flight #123 Details')
 *
 * // Show/hide loading state
 * setLoading(true)
 *
 * // Add custom header action
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
