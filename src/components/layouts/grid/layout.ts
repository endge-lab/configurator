import type {
  CreateWidgetInstanceOptions,
  FloatingWidgetState,
  LayoutOptions,
  LayoutWidgetsState,
  WidgetDefinition,
  WidgetDefinitionState,
  WidgetHeaderAction,
  WidgetInstance,
  WidgetPosition,
} from '@/components/layouts/grid/types.ts'
import type { WidgetChannelMessage, WidgetPopupState } from '@/components/layouts/grid/widget-channel.ts'
import type { ComputedRef, Ref } from 'vue'

import { useLocalStorage, useTitle } from '@vueuse/core'
import { computed, isRef, onBeforeUnmount, reactive, toValue, watch } from 'vue'

import {
  closePopupWindow,
  getHostWidgetChannel,
  getPopupWindow,
  isPopupOpen,
  registerPopupWindow,
  unregisterPopupWindow,
} from '@/components/layouts/grid/widget-channel.ts'
import { useBranding } from '@/lib/branding.ts'

const STORAGE_KEY = 'app:grid-layout-state'

function createDefaultAreaState() {
  return {
    size: 250,
    expanded: true,
    activeWidget: null as string | null,
  }
}

function createDefaultWidgetsState(): LayoutWidgetsState {
  return {
    areas: {
      left: createDefaultAreaState(),
      right: createDefaultAreaState(),
      bottom: createDefaultAreaState(),
      floating: {
        order: {},
        states: {},
      },
      popup: {
        states: {},
      },
    },
    definitions: {},
    instances: {},
  }
}

interface LayoutInternalState {
  widgets: LayoutWidgetsState
  isLoading: boolean
  title: string
  isDraggingWidget: boolean
  draggingWidgetId: string | null
}

const layoutState = reactive<LayoutInternalState>({
  widgets: createDefaultWidgetsState(),
  isLoading: false,
  title: '',
  isDraggingWidget: false,
  draggingWidgetId: null,
})

interface PersistedAreaState {
  size: number
  expanded: boolean
  activeWidget: string | null
  order: string[]
}

interface PersistedState {
  areas: {
    left: PersistedAreaState
    right: PersistedAreaState
    bottom: PersistedAreaState
    floating: {
      order: Record<string, number>
      states: Record<string, FloatingWidgetState>
    }
  }
  definitionPositions: Record<string, WidgetPosition>
}

function createDefaultPersistedAreaState(size = 250): PersistedAreaState {
  return {
    size,
    expanded: true,
    activeWidget: null,
    order: [],
  }
}

const defaultPersistedState: PersistedState = {
  areas: {
    left: createDefaultPersistedAreaState(250),
    right: createDefaultPersistedAreaState(250),
    bottom: createDefaultPersistedAreaState(200),
    floating: {
      order: {},
      states: {},
    },
  },
  definitionPositions: {},
}

const persistedState = useLocalStorage<PersistedState>(STORAGE_KEY, defaultPersistedState, {
  writeDefaults: false,
  mergeDefaults: (storageValue, defaults) => {
    const s = storageValue ?? {}
    const a = s.areas ?? {}
    return {
      areas: {
        left: { ...defaults.areas.left, ...a.left },
        right: { ...defaults.areas.right, ...a.right },
        bottom: { ...defaults.areas.bottom, ...a.bottom },
        floating: {
          order: { ...defaults.areas.floating.order, ...a.floating?.order },
          states: { ...defaults.areas.floating.states, ...a.floating?.states },
        },
      },
      definitionPositions: { ...defaults.definitionPositions, ...s.definitionPositions },
    }
  },
})

let nextZIndex = 1000

function getNextZIndex(): number {
  return nextZIndex++
}

let _isLayoutHydrated = false

function hydrateLayoutFromPersisted(): void {
  if (_isLayoutHydrated)
    return

  const positions: DockablePosition[] = ['left', 'right', 'bottom']

  positions.forEach((position: DockablePosition) => {
    ensurePersistedArea(position)

    const persistedArea: PersistedAreaState = persistedState.value.areas[position]

    // ВАЖНО: UI обычно читает layoutState.widgets.areas, поэтому гидратируем именно его
    layoutState.widgets.areas[position].size = persistedArea.size
    layoutState.widgets.areas[position].expanded = persistedArea.expanded
    layoutState.widgets.areas[position].activeWidget = persistedArea.activeWidget
  })

  _isLayoutHydrated = true
}

export function useLayout(options?: LayoutOptions) {
  hydrateLayoutFromPersisted()

  const { currentBranding } = useBranding()

  const fullTitle = computed(() => {
    const titleValue = options?.title ? toValue(options.title) : null
    const brandingName = currentBranding.value?.name

    if (titleValue) {
      layoutState.title = titleValue
      return `${titleValue} – ${brandingName}`
    }
    layoutState.title = brandingName ?? ''
    return brandingName
  })

  useTitle(fullTitle)

  const applyLayoutSettings = () => {
    if (options?.isLoading) {
      const isLoadingValue = toValue(options.isLoading)
      if (isLoadingValue !== undefined) {
        layoutState.isLoading = isLoadingValue
      }
    }
    else {
      layoutState.isLoading = false
    }
  }

  applyLayoutSettings()

  let stopLoadingWatch: (() => void) | undefined
  let stopLoadingReverseWatch: (() => void) | undefined
  const userIsLoadingRef = isRef(options?.isLoading) ? options.isLoading as Ref<boolean> : undefined

  if (options?.isLoading) {
    stopLoadingWatch = watch(
      () => toValue(options.isLoading),
      (newLoading) => {
        layoutState.isLoading = newLoading ?? false
      },
      { immediate: true },
    )

    if (userIsLoadingRef) {
      stopLoadingReverseWatch = watch(
        () => layoutState.isLoading,
        (newLoading) => {
          if (userIsLoadingRef.value !== newLoading) {
            userIsLoadingRef.value = newLoading
          }
        },
      )
    }
  }

  onBeforeUnmount(() => {
    stopLoadingWatch?.()
    stopLoadingReverseWatch?.()
  })

  return {
    isLoading: userIsLoadingRef ?? computed(() => layoutState.isLoading),
    title: computed(() => layoutState.title),
    widgets: computed(() => layoutState.widgets),
    setIsLoading: (isLoading: boolean) => {
      layoutState.isLoading = isLoading
    },
  }
}

export function getLayoutState() {
  return {
    isLoading: computed(() => layoutState.isLoading),
    title: computed(() => layoutState.title),
    widgets: computed(() => layoutState.widgets),
    isDraggingWidget: computed(() => layoutState.isDraggingWidget),
    draggingWidgetId: computed(() => layoutState.draggingWidgetId),
  }
}

export function startWidgetDrag(widgetId: string) {
  layoutState.isDraggingWidget = true
  layoutState.draggingWidgetId = widgetId
}

export function endWidgetDrag() {
  layoutState.isDraggingWidget = false
  layoutState.draggingWidgetId = null
}

export function getWidgetOrder(position: WidgetPosition): string[] {
  if (position === 'floating' || position === 'popup')
    return []
  return persistedState.value.areas[position]?.order ?? []
}

export function reorderWidget(widgetId: string, targetWidgetId: string, position: WidgetPosition): void {
  if (position === 'floating' || position === 'popup')
    return

  const areaState = persistedState.value.areas[position]
  if (!areaState.order) {
    areaState.order = []
  }
  const currentOrder = areaState.order

  const widgetsInPosition = Object.values(layoutState.widgets.definitions)
    .filter(d => d.position === position)
    .map(d => d.id)

  const order = currentOrder.filter(id => widgetsInPosition.includes(id))

  widgetsInPosition.forEach((id) => {
    if (!order.includes(id)) {
      order.push(id)
    }
  })

  const fromIndex = order.indexOf(widgetId)
  const toIndex = order.indexOf(targetWidgetId)

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex)
    return

  order.splice(fromIndex, 1)
  order.splice(toIndex, 0, widgetId)

  areaState.order = order
}

export function useStateProvider(state: {
  fullscreenContentHeight: ComputedRef<number>
  fullscreenContentWidth: ComputedRef<number>
}) {
  const stopFullscreenContentHeightWatch = watch(
    () => state.fullscreenContentHeight.value,
    () => {},
    { immediate: true },
  )

  const stopFullscreenContentWidthWatch = watch(
    () => state.fullscreenContentWidth.value,
    () => {},
    { immediate: true },
  )

  onBeforeUnmount(() => {
    stopFullscreenContentHeightWatch()
    stopFullscreenContentWidthWatch()
  })
}

// Area state getters and setters
type DockablePosition = 'left' | 'right' | 'bottom'

function ensurePersistedArea(position: DockablePosition): void {
  if (!persistedState.value.areas[position]) {
    persistedState.value.areas[position] = createDefaultPersistedAreaState(position === 'bottom' ? 200 : 250)
  }
}

export function getAreaSize(position: DockablePosition): number {
  return persistedState.value.areas[position]?.size ?? (position === 'bottom' ? 200 : 250)
}

export function setAreaSize(position: DockablePosition, size: number): void {
  ensurePersistedArea(position)
  persistedState.value.areas[position].size = size
}

export function getAreaExpanded(position: DockablePosition): boolean {
  return persistedState.value.areas[position]?.expanded ?? true
}

export function setAreaExpanded(position: DockablePosition, expanded: boolean): void {
  ensurePersistedArea(position)
  persistedState.value.areas[position].expanded = expanded
  layoutState.widgets.areas[position].expanded = expanded
}

export function getAreaActiveWidget(position: DockablePosition): string | null {
  return persistedState.value.areas[position]?.activeWidget ?? null
}

function syncActiveWidget(position: DockablePosition, widgetId: string | null): void {
  ensurePersistedArea(position)
  persistedState.value.areas[position].activeWidget = widgetId
  layoutState.widgets.areas[position].activeWidget = widgetId
}

function syncExpanded(position: DockablePosition, expanded: boolean): void {
  ensurePersistedArea(position)
  persistedState.value.areas[position].expanded = expanded
  layoutState.widgets.areas[position].expanded = expanded
}

function syncFloatingWidgetState(definitionId: string): void {
  const state = layoutState.widgets.areas.floating.states[definitionId]
  const order = layoutState.widgets.areas.floating.order[definitionId]
  if (state !== undefined) {
    if (!persistedState.value.areas.floating.states) {
      persistedState.value.areas.floating.states = {}
    }
    persistedState.value.areas.floating.states[definitionId] = { ...state }
  }
  if (order !== undefined) {
    if (!persistedState.value.areas.floating.order) {
      persistedState.value.areas.floating.order = {}
    }
    persistedState.value.areas.floating.order[definitionId] = order
  }
}

export function setAreaActiveWidget(position: DockablePosition, widgetId: string | null): void {
  syncActiveWidget(position, widgetId)
}

export function registerWidget(definition: WidgetDefinition): void {
  // Validate required fields
  if (!definition.id || typeof definition.id !== 'string')
    throw new Error('Widget definition must have a valid string id')
  if (!definition.title || typeof definition.title !== 'string')
    throw new Error('Widget definition must have a valid string title')
  if (!definition.icon)
    throw new Error('Widget definition must have an icon')
  if (definition.content !== 'component' && definition.content !== 'iframe')
    throw new Error('Widget definition content must be "component" or "iframe"')

  // Validate content-specific fields
  if (definition.content === 'iframe') {
    if ('defaultComponent' in definition && definition.defaultComponent !== undefined)
      throw new Error('iframe widget cannot have defaultComponent')
    if ('defaultProps' in definition && definition.defaultProps !== undefined)
      throw new Error('iframe widget cannot have defaultProps')
  }
  if (definition.content === 'component') {
    if ('defaultUrl' in definition && definition.defaultUrl !== undefined)
      throw new Error('component widget cannot have defaultUrl')
  }

  // Validate popup restrictions for component widgets
  if (definition.content === 'component') {
    if (definition.allowedPositions?.includes('popup'))
      throw new Error('component widget cannot include "popup" in allowedPositions')
    if (definition.defaultPosition === 'popup')
      throw new Error('component widget cannot have "popup" as defaultPosition')
  }

  // Validate defaultPosition is in allowedPositions
  if (definition.allowedPositions && definition.defaultPosition) {
    if (!definition.allowedPositions.includes(definition.defaultPosition))
      throw new Error(`defaultPosition "${definition.defaultPosition}" must be included in allowedPositions`)
  }

  // Validate floatingConstraints only when floating is allowed
  if (definition.floatingConstraints) {
    const allowedPositions = definition.allowedPositions ?? ['left', 'right', 'bottom', 'floating']
    if (!allowedPositions.includes('floating'))
      throw new Error('floatingConstraints can only be specified when "floating" is in allowedPositions')
  }

  const savedPosition = persistedState.value.definitionPositions[definition.id]
  // popup is a transient state (opens browser window), so fall back to floating or default
  const position = savedPosition === 'popup'
    ? (definition.defaultPosition ?? 'floating')
    : (savedPosition ?? definition.defaultPosition ?? 'left')

  const definitionWithState: WidgetDefinition & WidgetDefinitionState = {
    ...definition,
    position,
    minimized: false,
  }

  layoutState.widgets.definitions[definition.id] = definitionWithState

  // Restore persisted activeWidget or set as active if none
  if (position === 'left' || position === 'right' || position === 'bottom') {
    ensurePersistedArea(position)
    const persistedArea = persistedState.value.areas[position]
    // Восстанавливаем expanded из persistedState
    if (persistedArea?.expanded !== undefined) {
      layoutState.widgets.areas[position].expanded = persistedArea.expanded
    }

    // Добавляем виджет в порядок, если его там нет
    if (!persistedArea.order) {
      persistedArea.order = []
    }
    if (!persistedArea.order.includes(definition.id)) {
      persistedArea.order.push(definition.id)
    }

    const persistedActive: string | null = persistedArea?.activeWidget ?? null
    if (persistedActive === definition.id) {
      syncActiveWidget(position, definition.id)
    }
    else if (!persistedActive && !layoutState.widgets.areas[position].activeWidget) {
      // Только если в persisted вообще ничего не выбрано
      syncActiveWidget(position, definition.id)
    }
  }

  if (position === 'floating') {
    // Восстанавливаем состояние из persistedState, если оно есть
    const persistedFloatingState = persistedState.value.areas.floating?.states[definition.id]
    if (persistedFloatingState) {
      layoutState.widgets.areas.floating.states[definition.id] = { ...persistedFloatingState }
      const persistedOrder = persistedState.value.areas.floating?.order[definition.id]
      if (persistedOrder !== undefined) {
        layoutState.widgets.areas.floating.order[definition.id] = persistedOrder
      }
    }
    else {
      // Создаем новое состояние только если его нет в persistedState
      const constraints = definition.floatingConstraints ?? {}
      const zIndex = getNextZIndex()
      layoutState.widgets.areas.floating.order[definition.id] = zIndex
      layoutState.widgets.areas.floating.states[definition.id] = {
        x: 100 + Math.random() * 100,
        y: 100 + Math.random() * 100,
        width: constraints.defaultWidth ?? 400,
        height: constraints.defaultHeight ?? 300,
        zIndex,
        minimized: false,
      }
      syncFloatingWidgetState(definition.id)
    }
  }
}

export function unregisterWidget(definitionId: string): void {
  const definition = layoutState.widgets.definitions[definitionId]
  if (!definition)
    return

  const position = definition.position

  const instancesToRemove = Object.values(layoutState.widgets.instances)
    .filter(i => i.definitionId === definitionId)
    .map(i => i.id)

  instancesToRemove.forEach((id) => {
    delete layoutState.widgets.instances[id]
  })

  // Delete definition first so it's not included in the search for other widgets
  delete layoutState.widgets.definitions[definitionId]

  // Find another widget in the same area to activate
  if (position === 'left' || position === 'right' || position === 'bottom') {
    const area = layoutState.widgets.areas[position]
    if (area.activeWidget === definitionId) {
      const otherWidgetsInArea = Object.values(layoutState.widgets.definitions)
        .filter(d => d.position === position && !d.minimized)
        .filter(d => getWidgetInstances(d.id).length > 0)
      syncActiveWidget(position, otherWidgetsInArea[0]?.id ?? null)
    }
    // Удаляем виджет из порядка
    const persistedArea = persistedState.value.areas[position]
    if (persistedArea?.order) {
      const index = persistedArea.order.indexOf(definitionId)
      if (index !== -1) {
        persistedArea.order.splice(index, 1)
      }
    }
  }
}

export function unregisterAllWidgets(): void {
  layoutState.widgets.definitions = {}
  layoutState.widgets.instances = {}
  syncActiveWidget('left', null)
  syncActiveWidget('right', null)
  syncActiveWidget('bottom', null)
  layoutState.widgets.areas.floating.order = {}
  layoutState.widgets.areas.floating.states = {}
}

export function getWidget(definitionId: string) {
  const definition = layoutState.widgets.definitions[definitionId]
  if (!definition)
    return null

  const instances = Object.values(layoutState.widgets.instances)
    .filter(i => i.definitionId === definitionId)

  return {
    ...definition,
    instances,
  }
}

export function getWidgetsByPosition(position: WidgetPosition) {
  return Object.values(layoutState.widgets.definitions)
    .filter(d => d.position === position)
}

export function getWidgetInstances(definitionId: string) {
  return Object.values(layoutState.widgets.instances)
    .filter(i => i.definitionId === definitionId)
}

// Track popups that sent 'popup-unloading' - pending close/refresh detection
const popupUnloadingTimers = new Map<string, ReturnType<typeof setTimeout>>()

// Track popup close check intervals so they can be cancelled on intentional moves
const popupCloseCheckIntervals = new Map<string, ReturnType<typeof setInterval>>()

export function moveWidget(definitionId: string, position: WidgetPosition): void {
  const definition = layoutState.widgets.definitions[definitionId]
  if (!definition)
    return

  const allowedPositions = definition.allowedPositions ?? ['left', 'right', 'bottom', 'floating']
  if (!allowedPositions.includes(position))
    return

  if (definition.content === 'component' && position === 'popup')
    return

  const oldPosition = definition.position

  if (oldPosition === 'left' || oldPosition === 'right' || oldPosition === 'bottom') {
    if (layoutState.widgets.areas[oldPosition].activeWidget === definitionId) {
      const otherWidgetsInArea = Object.values(layoutState.widgets.definitions)
        .filter(d => d.id !== definitionId && d.position === oldPosition)
        .filter(d => getWidgetInstances(d.id).length > 0)
      syncActiveWidget(oldPosition, otherWidgetsInArea[0]?.id ?? null)
    }
    // Удаляем виджет из порядка старой позиции
    const oldPersistedArea = persistedState.value.areas[oldPosition]
    if (oldPersistedArea?.order) {
      const index = oldPersistedArea.order.indexOf(definitionId)
      if (index !== -1) {
        oldPersistedArea.order.splice(index, 1)
      }
    }
  }

  if (oldPosition === 'floating') {
    delete layoutState.widgets.areas.floating.order[definitionId]
    delete layoutState.widgets.areas.floating.states[definitionId]
    // Удаляем из persistedState
    if (persistedState.value.areas.floating.order) {
      delete persistedState.value.areas.floating.order[definitionId]
    }
    if (persistedState.value.areas.floating.states) {
      delete persistedState.value.areas.floating.states[definitionId]
    }
  }

  // Close all popup windows when moving from popup to another position
  if (oldPosition === 'popup') {
    const instances = getWidgetInstances(definitionId)
    instances.forEach((instance) => {
      // Cancel popup close check interval to prevent delayed destroy
      const interval = popupCloseCheckIntervals.get(instance.id)
      if (interval) {
        clearInterval(interval)
        popupCloseCheckIntervals.delete(instance.id)
      }
      // Cancel any pending unloading timer
      const timer = popupUnloadingTimers.get(instance.id)
      if (timer) {
        clearTimeout(timer)
        popupUnloadingTimers.delete(instance.id)
      }

      if (isPopupOpen(instance.id)) {
        // Send message to close popup without destroying instance
        // The popup will close itself after receiving this message
        getHostWidgetChannel().send({
          type: 'close-popup-keep-instance',
          instanceId: instance.id,
        })
        // Unregister the popup reference (the popup will close itself)
        unregisterPopupWindow(instance.id)
      }
      // Clear popup state
      delete layoutState.widgets.areas.popup.states[instance.id]
    })
  }

  definition.position = position
  definition.minimized = false

  persistedState.value.definitionPositions[definitionId] = position

  if (position === 'left' || position === 'right' || position === 'bottom') {
    ensurePersistedArea(position)
    const persistedArea = persistedState.value.areas[position]
    // Добавляем виджет в порядок новой позиции, если его там нет
    if (!persistedArea.order) {
      persistedArea.order = []
    }
    if (!persistedArea.order.includes(definitionId)) {
      persistedArea.order.push(definitionId)
    }
    syncActiveWidget(position, definitionId)
    syncExpanded(position, true)
  }
  else if (position === 'floating') {
    const constraints = definition.floatingConstraints ?? {}
    layoutState.widgets.areas.floating.order[definitionId] = getNextZIndex()
    layoutState.widgets.areas.floating.states[definitionId] = {
      x: 100 + Math.random() * 100,
      y: 100 + Math.random() * 100,
      width: constraints.defaultWidth ?? 400,
      height: constraints.defaultHeight ?? 300,
      zIndex: layoutState.widgets.areas.floating.order[definitionId],
      minimized: false,
    }
    syncFloatingWidgetState(definitionId)
  }
  else if (position === 'popup') {
    const instances = getWidgetInstances(definitionId)
    instances.forEach((instance) => {
      openWidgetPopup(instance.id)
    })
  }
}

export function showWidget(definitionId: string): void {
  const definition = layoutState.widgets.definitions[definitionId]
  if (!definition)
    return

  definition.minimized = false
  const position = definition.position

  if (position === 'left' || position === 'right' || position === 'bottom') {
    syncActiveWidget(position, definitionId)
    syncExpanded(position, true)
  }
  else if (position === 'floating') {
    const state = layoutState.widgets.areas.floating.states[definitionId]
    if (state) {
      state.minimized = false
      state.zIndex = getNextZIndex()
      layoutState.widgets.areas.floating.order[definitionId] = state.zIndex
      syncFloatingWidgetState(definitionId)
    }
  }
  else if (position === 'popup') {
    const instances = getWidgetInstances(definitionId)
    instances.forEach((instance) => {
      if (!isPopupOpen(instance.id)) {
        openWidgetPopup(instance.id)
      }
    })
  }
}

export function hideWidget(definitionId: string): void {
  const definition = layoutState.widgets.definitions[definitionId]
  if (!definition)
    return

  const position = definition.position

  if (position === 'left' || position === 'right' || position === 'bottom') {
    if (layoutState.widgets.areas[position].activeWidget === definitionId) {
      syncExpanded(position, false)
    }
  }
  else if (position === 'floating') {
    const state = layoutState.widgets.areas.floating.states[definitionId]
    if (state) {
      state.minimized = true
      syncFloatingWidgetState(definitionId)
    }
  }

  definition.minimized = true
}

export function toggleWidget(definitionId: string): void {
  const definition = layoutState.widgets.definitions[definitionId]
  if (!definition)
    return

  const position = definition.position

  if (position === 'left' || position === 'right' || position === 'bottom') {
    if (layoutState.widgets.areas[position].activeWidget === definitionId) {
      const newExpanded = !layoutState.widgets.areas[position].expanded
      syncExpanded(position, newExpanded)
      definition.minimized = !newExpanded
    }
    else {
      syncActiveWidget(position, definitionId)
      syncExpanded(position, true)
      definition.minimized = false
    }
  }
  else if (definition.position === 'floating') {
    const state = layoutState.widgets.areas.floating.states[definitionId]
    if (state) {
      state.minimized = !state.minimized
      definition.minimized = state.minimized
      if (!state.minimized) {
        state.zIndex = getNextZIndex()
        layoutState.widgets.areas.floating.order[definitionId] = state.zIndex
      }
      syncFloatingWidgetState(definitionId)
    }
  }
}

let instanceIdCounter = 0

export function createWidgetInstance(
  definitionId: string,
  instance: Omit<WidgetInstance, 'id' | 'definitionId'>,
  options?: CreateWidgetInstanceOptions,
): string {
  const definition = layoutState.widgets.definitions[definitionId]
  if (!definition)
    throw new Error(`Widget definition "${definitionId}" not found`)

  // Validate content-specific instance fields
  if (definition.content === 'iframe') {
    if ('component' in instance && instance.component !== undefined)
      throw new Error('iframe widget instance cannot have component')
    if ('props' in instance && instance.props !== undefined)
      throw new Error('iframe widget instance cannot have props')

    // Check if url is required (no default url in definition)
    const hasUrl = 'url' in instance && instance.url !== undefined
    const hasDefaultUrl = 'defaultUrl' in definition && definition.defaultUrl !== undefined
    if (!hasUrl && !hasDefaultUrl)
      throw new Error('iframe widget instance requires url (no defaultUrl in definition)')
  }

  if (definition.content === 'component') {
    if ('url' in instance && instance.url !== undefined)
      throw new Error('component widget instance cannot have url')

    // Check if component is required (no default component in definition)
    const hasComponent = 'component' in instance && instance.component !== undefined
    const hasDefaultComponent = 'defaultComponent' in definition && definition.defaultComponent !== undefined
    if (!hasComponent && !hasDefaultComponent)
      throw new Error('component widget instance requires component (no defaultComponent in definition)')
  }

  if (definition.singleton) {
    const existingInstances = getWidgetInstances(definitionId)
    existingInstances.forEach((i) => {
      delete layoutState.widgets.instances[i.id]
    })
  }

  const id = `${definitionId}-${++instanceIdCounter}`

  const newInstance: WidgetInstance = {
    ...instance,
    id,
    definitionId,
  }

  layoutState.widgets.instances[id] = newInstance

  const shouldActivate: boolean = options?.activate ?? true
  if (shouldActivate) {
    showWidget(definitionId)
  }

  return id
}

export function destroyWidgetInstance(instanceId: string): void {
  const instance = layoutState.widgets.instances[instanceId]
  if (!instance)
    return

  const definition = layoutState.widgets.definitions[instance.definitionId]
  const definitionId = instance.definitionId

  delete layoutState.widgets.instances[instanceId]
  delete layoutState.widgets.areas.popup.states[instanceId]

  const remainingInstances = getWidgetInstances(definitionId)
  if (remainingInstances.length === 0 && definition) {
    definition.minimized = true

    // If this widget was active in its area, activate another widget in the same area
    const position = definition.position
    if (position === 'left' || position === 'right' || position === 'bottom') {
      const area = layoutState.widgets.areas[position]
      if (area.activeWidget === definitionId) {
        const otherWidgetsInArea = Object.values(layoutState.widgets.definitions)
          .filter(d => d.id !== definitionId && d.position === position && !d.minimized)
          .filter(d => getWidgetInstances(d.id).length > 0)
        syncActiveWidget(position, otherWidgetsInArea[0]?.id ?? null)
      }
    }
  }
}

export function destroyAllWidgetInstances(definitionId: string): void {
  const instances = getWidgetInstances(definitionId)
  instances.forEach((instance) => {
    delete layoutState.widgets.instances[instance.id]
  })

  const definition = layoutState.widgets.definitions[definitionId]
  if (definition) {
    definition.minimized = true

    // If this widget was active in its area, activate another widget in the same area
    const position = definition.position
    if (position === 'left' || position === 'right' || position === 'bottom') {
      const area = layoutState.widgets.areas[position]
      if (area.activeWidget === definitionId) {
        const otherWidgetsInArea = Object.values(layoutState.widgets.definitions)
          .filter(d => d.id !== definitionId && d.position === position && !d.minimized)
          .filter(d => getWidgetInstances(d.id).length > 0)
        syncActiveWidget(position, otherWidgetsInArea[0]?.id ?? null)
      }
    }
  }
}

export function getWidgetInstance(instanceId: string): WidgetInstance | null {
  return layoutState.widgets.instances[instanceId] ?? null
}

export function focusWidgetInstance(instanceId: string): void {
  const instance = layoutState.widgets.instances[instanceId]
  if (!instance)
    return

  showWidget(instance.definitionId)
}

export function setWidgetInstanceTitle(instanceId: string, title: string): void {
  const instance = layoutState.widgets.instances[instanceId]
  if (instance) {
    instance.title = title
  }
}

export function setWidgetInstanceLoading(instanceId: string, isLoading: boolean): void {
  const instance = layoutState.widgets.instances[instanceId]
  if (instance) {
    instance.isLoading = isLoading
  }
}

export function addHeaderAction(instanceId: string, action: WidgetHeaderAction): void {
  const instance = layoutState.widgets.instances[instanceId]
  if (!instance)
    return

  if (!instance.headerActions) {
    instance.headerActions = { header: [], options: [] }
  }
  instance.headerActions.header.push(action)
}

export function removeHeaderAction(instanceId: string, actionId: string): void {
  const instance = layoutState.widgets.instances[instanceId]
  if (!instance?.headerActions)
    return

  instance.headerActions.header = instance.headerActions.header.filter(a => a.id !== actionId)
}

export function addOptionsAction(instanceId: string, action: WidgetHeaderAction): void {
  const instance = layoutState.widgets.instances[instanceId]
  if (!instance)
    return

  if (!instance.headerActions) {
    instance.headerActions = { header: [], options: [] }
  }
  instance.headerActions.options.push(action)
}

export function removeOptionsAction(instanceId: string, actionId: string): void {
  const instance = layoutState.widgets.instances[instanceId]
  if (!instance?.headerActions)
    return

  instance.headerActions.options = instance.headerActions.options.filter(a => a.id !== actionId)
}

export function updateFloatingWidgetState(
  definitionId: string,
  updates: Partial<FloatingWidgetState>,
): void {
  const state = layoutState.widgets.areas.floating.states[definitionId]
  if (state) {
    Object.assign(state, updates)
    syncFloatingWidgetState(definitionId)
  }
}

export function bringFloatingWidgetToFront(definitionId: string): void {
  const state = layoutState.widgets.areas.floating.states[definitionId]
  if (state) {
    state.zIndex = getNextZIndex()
    layoutState.widgets.areas.floating.order[definitionId] = state.zIndex
    syncFloatingWidgetState(definitionId)
  }
}

export function updateAreaSize(area: DockablePosition, size: number): void {
  ensurePersistedArea(area)
  layoutState.widgets.areas[area].size = size
  persistedState.value.areas[area].size = size
}

export function resetLayout() {
  layoutState.isLoading = false
  layoutState.title = ''
}

// Popup window management
export function openWidgetPopup(instanceId: string): Window | null {
  const instance = layoutState.widgets.instances[instanceId]
  if (!instance)
    return null

  const definition = layoutState.widgets.definitions[instance.definitionId]
  if (!definition || definition.content !== 'iframe')
    return null

  // Check if popup is already open
  if (isPopupOpen(instanceId)) {
    return null
  }

  const popupUrl = `/widget-popup/${instanceId}`
  const windowName = `widget-${instanceId}`
  const popup = window.open(popupUrl, windowName, 'width=800,height=600')

  if (popup) {
    registerPopupWindow(instanceId, popup)

    // Monitor popup close
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed)
        popupCloseCheckIntervals.delete(instanceId)
        unregisterPopupWindow(instanceId)

        // If no unloading signal was received (e.g. browser killed the window),
        // start a grace period to detect refresh vs true close
        if (!popupUnloadingTimers.has(instanceId)) {
          schedulePopupCloseCheck(instanceId)
        }
      }
    }, 500)
    popupCloseCheckIntervals.set(instanceId, checkClosed)
  }

  return popup
}

function serializeHeaderActions(actions?: { header: WidgetHeaderAction[], options: WidgetHeaderAction[] }) {
  if (!actions)
    return undefined

  const serialize = (action: WidgetHeaderAction) => ({
    id: action.id,
    title: action.title,
    iconName: action.icon,
    order: action.order,
    disabled: typeof action.disabled === 'boolean' ? action.disabled : false,
  })

  return {
    header: actions.header.map(serialize),
    options: actions.options.map(serialize),
  }
}

export function getWidgetPopupState(instanceId: string): WidgetPopupState | null {
  const instance = layoutState.widgets.instances[instanceId]
  if (!instance)
    return null

  const definition = layoutState.widgets.definitions[instance.definitionId]
  if (!definition || definition.content !== 'iframe')
    return null

  const iframeInstance = instance as { url?: string }
  const iframeDefinition = definition as { defaultUrl?: string }

  const headerActions = instance.headerActions ?? definition.defaultHeaderActions

  // Spread arrays to ensure they are plain arrays (not Vue reactive)
  const allowedPositions = [...(definition.allowedPositions ?? ['left', 'right', 'bottom', 'floating'])]

  return {
    url: iframeInstance.url ?? iframeDefinition.defaultUrl ?? '',
    title: instance.title ?? definition.title,
    definitionId: definition.id,
    definitionTitle: definition.title,
    definitionIconName: definition.icon,
    isLoading: instance.isLoading ?? false,
    allowedPositions,
    permanent: definition.permanent ?? false,
    detachable: definition.detachablePopup ?? false,
    headerActions: serializeHeaderActions(headerActions),
  }
}

function handleWidgetChannelMessage(message: WidgetChannelMessage) {
  switch (message.type) {
    case 'request-popup-state': {
      // Popup reconnected after refresh - cancel pending destroy
      const pendingTimer = popupUnloadingTimers.get(message.instanceId)
      if (pendingTimer) {
        clearTimeout(pendingTimer)
        popupUnloadingTimers.delete(message.instanceId)
      }

      const state = getWidgetPopupState(message.instanceId)
      if (state) {
        getHostWidgetChannel().send({
          type: 'popup-state',
          instanceId: message.instanceId,
          state,
        })
      }
      break
    }
    case 'move-widget': {
      const instance = layoutState.widgets.instances[message.instanceId]
      if (instance) {
        // The popup that sent this message already set shouldDestroyOnClose = false
        // So we just need to close it and move the widget
        // moveWidget will handle closing other popup instances with close-popup-keep-instance
        moveWidget(instance.definitionId, message.position)
      }
      break
    }
    case 'close-widget': {
      const instance = layoutState.widgets.instances[message.instanceId]
      if (instance) {
        closePopupWindow(message.instanceId)
        destroyWidgetInstance(message.instanceId)
      }
      break
    }
    case 'update-instance': {
      const instance = layoutState.widgets.instances[message.instanceId]
      if (instance) {
        if (message.updates.title !== undefined) {
          instance.title = message.updates.title
        }
        if (message.updates.isLoading !== undefined) {
          instance.isLoading = message.updates.isLoading
        }
        if (message.updates.headerActions !== undefined) {
          instance.headerActions = message.updates.headerActions
        }
        // Send updated state back to popup
        const state = getWidgetPopupState(message.instanceId)
        if (state) {
          getHostWidgetChannel().send({
            type: 'popup-state',
            instanceId: message.instanceId,
            state,
          })
        }
      }
      break
    }
    case 'header-action': {
      const instance = layoutState.widgets.instances[message.instanceId]
      if (instance) {
        const definition = layoutState.widgets.definitions[instance.definitionId]
        const allActions = [
          ...(instance.headerActions?.header ?? []),
          ...(instance.headerActions?.options ?? []),
          ...(definition?.defaultHeaderActions?.header ?? []),
          ...(definition?.defaultHeaderActions?.options ?? []),
        ]
        const action = allActions.find(a => a.id === message.actionId)
        action?.onClick?.()
      }
      break
    }
    case 'add-header-action': {
      const instance = layoutState.widgets.instances[message.instanceId]
      if (instance) {
        if (!instance.headerActions) {
          instance.headerActions = { header: [], options: [] }
        }
        const widgetAction = {
          id: message.action.id,
          title: message.action.title,
          icon: message.action.icon,
          order: message.action.order,
          disabled: message.action.disabled,
          onClick: () => {
            // Send click event back to popup iframe via channel
            getHostWidgetChannel().send({
              type: 'header-action',
              instanceId: message.instanceId,
              actionId: message.action.id,
            })
          },
        }
        if (message.location === 'options') {
          addOptionsAction(message.instanceId, widgetAction)
        }
        else {
          addHeaderAction(message.instanceId, widgetAction)
        }
        // Send updated state back to popup
        const state = getWidgetPopupState(message.instanceId)
        if (state) {
          getHostWidgetChannel().send({
            type: 'popup-state',
            instanceId: message.instanceId,
            state,
          })
        }
      }
      break
    }
    case 'remove-header-action': {
      const instance = layoutState.widgets.instances[message.instanceId]
      if (instance) {
        removeHeaderAction(message.instanceId, message.actionId)
        removeOptionsAction(message.instanceId, message.actionId)
        // Send updated state back to popup
        const state = getWidgetPopupState(message.instanceId)
        if (state) {
          getHostWidgetChannel().send({
            type: 'popup-state',
            instanceId: message.instanceId,
            state,
          })
        }
      }
      break
    }
    case 'popup-minimized': {
      // Cancel popup close check interval to prevent delayed destroy
      const interval = popupCloseCheckIntervals.get(message.instanceId)
      if (interval) {
        clearInterval(interval)
        popupCloseCheckIntervals.delete(message.instanceId)
      }
      // Cancel any pending unloading timer
      const timer = popupUnloadingTimers.get(message.instanceId)
      if (timer) {
        clearTimeout(timer)
        popupUnloadingTimers.delete(message.instanceId)
      }
      // Unregister popup window reference (it's closing)
      unregisterPopupWindow(message.instanceId)
      // Track minimized state for popup instance
      layoutState.widgets.areas.popup.states[message.instanceId] = { minimized: true }
      break
    }
    case 'popup-unloading': {
      // Popup is unloading (refresh or close) - schedule a delayed check
      schedulePopupCloseCheck(message.instanceId)
      break
    }
  }
}

function schedulePopupCloseCheck(instanceId: string) {
  // Clear any existing timer for this instance
  const existing = popupUnloadingTimers.get(instanceId)
  if (existing) {
    clearTimeout(existing)
  }

  // Wait for the popup to potentially reconnect (refresh)
  // If request-popup-state arrives within this window, the timer is cancelled
  const timer = setTimeout(() => {
    popupUnloadingTimers.delete(instanceId)

    // If popup didn't reconnect, it was truly closed - destroy the instance
    const instance = layoutState.widgets.instances[instanceId]
    if (instance) {
      closePopupWindow(instanceId)
      destroyWidgetInstance(instanceId)
    }
  }, 2000)

  popupUnloadingTimers.set(instanceId, timer)
}

// Initialize channel listener for host window
let channelInitialized = false

export function initWidgetChannel() {
  if (channelInitialized)
    return

  channelInitialized = true
  const channel = getHostWidgetChannel()
  channel.subscribe(handleWidgetChannelMessage)

  // Handle popups when host window closes
  window.addEventListener('beforeunload', handleHostWindowClose)
}

export function handleHostWindowClose() {
  const channel = getHostWidgetChannel()
  Object.values(layoutState.widgets.instances).forEach((instance) => {
    const definition = layoutState.widgets.definitions[instance.definitionId]
    if (definition?.content === 'iframe') {
      if (isPopupOpen(instance.id)) {
        if (definition.detachablePopup) {
          // Detachable popups stay open but become "detached"
          channel.send({
            type: 'popup-detached',
            instanceId: instance.id,
          })
        }
        else {
          // Non-detachable popups are closed
          channel.send({
            type: 'popup-closed',
            instanceId: instance.id,
          })
          closePopupWindow(instance.id)
        }
      }
    }
  })
}

export function closeNonDetachablePopups() {
  const channel = getHostWidgetChannel()
  Object.values(layoutState.widgets.instances).forEach((instance) => {
    const definition = layoutState.widgets.definitions[instance.definitionId]
    if (definition?.content === 'iframe' && !definition.detachablePopup) {
      if (isPopupOpen(instance.id)) {
        channel.send({
          type: 'popup-closed',
          instanceId: instance.id,
        })
        closePopupWindow(instance.id)
      }
    }
  })
}

export function cleanupWidgetChannel() {
  window.removeEventListener('beforeunload', handleHostWindowClose)
}

export function restorePopupInstance(instanceId: string) {
  const instance = layoutState.widgets.instances[instanceId]
  if (!instance)
    return

  const definition = layoutState.widgets.definitions[instance.definitionId]
  if (!definition || definition.content !== 'iframe')
    return

  // Clear minimized state
  if (layoutState.widgets.areas.popup.states[instanceId]) {
    layoutState.widgets.areas.popup.states[instanceId].minimized = false
  }

  // If popup is open, focus it directly using window reference
  if (isPopupOpen(instanceId)) {
    const popupWindow = getPopupWindow(instanceId)
    if (popupWindow && !popupWindow.closed) {
      popupWindow.focus()
    }
  }
  else {
    // Open new popup window
    openWidgetPopup(instanceId)
  }
}

export function getPopupInstances(): { instance: WidgetInstance, definition: WidgetDefinition & WidgetDefinitionState, isMinimized: boolean, isOpen: boolean }[] {
  const result: { instance: WidgetInstance, definition: WidgetDefinition & WidgetDefinitionState, isMinimized: boolean, isOpen: boolean }[] = []

  Object.values(layoutState.widgets.instances).forEach((instance) => {
    const definition = layoutState.widgets.definitions[instance.definitionId]
    if (definition?.position === 'popup' && definition.content === 'iframe') {
      const popupState = layoutState.widgets.areas.popup.states[instance.id]
      const isOpen = isPopupOpen(instance.id)
      result.push({
        instance,
        definition,
        isMinimized: popupState?.minimized ?? false,
        isOpen,
      })
    }
  })

  return result
}
