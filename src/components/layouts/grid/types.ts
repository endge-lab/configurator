import type { Component, MaybeRefOrGetter, Reactive } from 'vue'

export type WidgetPosition = 'left' | 'right' | 'bottom' | 'floating' | 'popup'

export interface WidgetHeaderAction {
  readonly id: string
  readonly title?: string
  readonly icon?: string
  order?: number
  disabled?: MaybeRefOrGetter<boolean | (() => boolean)>
  readonly onClick?: () => void
}

export interface CreateWidgetInstanceOptions {
  activate?: boolean
}

export interface WidgetFloatingConstraints {
  readonly minWidth?: number
  readonly maxWidth?: number
  readonly minHeight?: number
  readonly maxHeight?: number
  readonly defaultWidth?: number
  readonly defaultHeight?: number
}

export interface WidgetDefinitionBase {
  readonly id: string
  readonly title: string
  readonly icon: string
  readonly singleton?: boolean
  readonly allowedPositions?: WidgetPosition[]
  readonly defaultPosition?: WidgetPosition
  readonly detachablePopup?: boolean
  readonly permanent?: boolean
  readonly defaultHeaderActions?: {
    header: WidgetHeaderAction[]
    options: WidgetHeaderAction[]
  }
  readonly floatingConstraints?: WidgetFloatingConstraints
}

export interface WidgetDefinitionComponent extends WidgetDefinitionBase {
  readonly content: 'component'
  readonly defaultComponent?: Component
  readonly defaultProps?: Reactive<Record<string, unknown>>
}

export interface WidgetDefinitionIframe extends WidgetDefinitionBase {
  readonly content: 'iframe'
  readonly defaultUrl?: string
}

export type WidgetDefinition = WidgetDefinitionComponent | WidgetDefinitionIframe

export interface WidgetDefinitionState {
  position: WidgetPosition
  minimized: boolean
}

export interface WidgetInstanceBase {
  readonly id: string
  readonly definitionId: string
  title?: string
  isLoading?: boolean
  headerActions?: {
    header: WidgetHeaderAction[]
    options: WidgetHeaderAction[]
  }
}

export interface WidgetInstanceComponent extends WidgetInstanceBase {
  component?: Component
  props?: Reactive<Record<string, unknown>>
}

export interface WidgetInstanceIframe extends WidgetInstanceBase {
  url?: string
}

export type WidgetInstance = WidgetInstanceComponent | WidgetInstanceIframe

export interface LayoutWidgetAreaState {
  size: number
  expanded: boolean
  activeWidget: string | null
}

export interface FloatingWidgetState {
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  minimized: boolean
}

export interface PopupInstanceState {
  minimized: boolean
}

export interface LayoutWidgetsState {
  areas: {
    left: LayoutWidgetAreaState
    right: LayoutWidgetAreaState
    bottom: LayoutWidgetAreaState
    floating: {
      order: Record<string, number>
      states: Record<string, FloatingWidgetState>
    }
    popup: {
      states: Record<string, PopupInstanceState>
    }
  }
  definitions: Record<string, WidgetDefinition & WidgetDefinitionState>
  instances: Record<string, WidgetInstance>
}

export interface LayoutState {
  widgets: LayoutWidgetsState
  isLoading: boolean
  title: string
}

export interface LayoutOptions {
  title?: MaybeRefOrGetter<string | null | undefined>
  isLoading?: MaybeRefOrGetter<boolean>
}
