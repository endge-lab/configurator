import type { WidgetPosition } from '@/components/layouts/grid/types.ts'

const CHANNEL_NAME = 'replaceme:widget-channel'

// Serializable version of header action (no Component or function references)
export interface SerializableHeaderAction {
  id: string
  title?: string
  iconName?: string
  order?: number
  disabled?: boolean
}

export interface WidgetPopupState {
  url: string
  title: string
  definitionId: string
  definitionTitle: string
  definitionIconName?: string
  isLoading: boolean
  allowedPositions: WidgetPosition[]
  permanent: boolean
  detachable: boolean
  headerActions?: {
    header: SerializableHeaderAction[]
    options: SerializableHeaderAction[]
  }
}

export type WidgetChannelMessage
  = | {
    type: 'request-popup-state'
    instanceId: string
  }
  | {
    type: 'popup-state'
    instanceId: string
    state: WidgetPopupState
  }
  | {
    type: 'popup-closed'
    instanceId: string
  }
  | {
    type: 'move-widget'
    instanceId: string
    position: WidgetPosition
  }
  | {
    type: 'close-widget'
    instanceId: string
  }
  | {
    type: 'update-instance'
    instanceId: string
    updates: {
      title?: string
      isLoading?: boolean
      headerActions?: {
        header: SerializableHeaderAction[]
        options: SerializableHeaderAction[]
      }
    }
  }
  | {
    type: 'header-action'
    instanceId: string
    actionId: string
  }
  | {
    type: 'popup-opened'
    instanceId: string
    windowName: string
  }
  | {
    type: 'popup-detached'
    instanceId: string
  }
  | {
    type: 'popup-minimized'
    instanceId: string
  }
  | {
    type: 'restore-popup'
    instanceId: string
  }
  | {
    type: 'close-popup-keep-instance'
    instanceId: string
  }
  | {
    type: 'popup-unloading'
    instanceId: string
  }
  | {
    type: 'add-header-action'
    instanceId: string
    action: { id: string, title?: string, icon?: string, order?: number, disabled?: boolean }
    location: 'header' | 'options'
  }
  | {
    type: 'remove-header-action'
    instanceId: string
    actionId: string
  }

type MessageHandler = (message: WidgetChannelMessage) => void

export function createWidgetChannel() {
  const channel = new BroadcastChannel(CHANNEL_NAME)
  const handlers = new Set<MessageHandler>()

  channel.onmessage = (event: MessageEvent<WidgetChannelMessage>) => {
    handlers.forEach(handler => handler(event.data))
  }

  return {
    send(message: WidgetChannelMessage) {
      channel.postMessage(message)
    },
    subscribe(handler: MessageHandler) {
      handlers.add(handler)
    },
    unsubscribe(handler: MessageHandler) {
      handlers.delete(handler)
    },
    close() {
      channel.close()
    },
  }
}

// Singleton for host window
let hostChannel: ReturnType<typeof createWidgetChannel> | null = null

export function getHostWidgetChannel() {
  if (!hostChannel) {
    hostChannel = createWidgetChannel()
  }
  return hostChannel
}

// Track open popup windows
const openPopups = new Map<string, Window>()

export function registerPopupWindow(instanceId: string, windowRef: Window) {
  openPopups.set(instanceId, windowRef)
}

export function unregisterPopupWindow(instanceId: string) {
  openPopups.delete(instanceId)
}

export function getPopupWindow(instanceId: string): Window | undefined {
  return openPopups.get(instanceId)
}

export function isPopupOpen(instanceId: string): boolean {
  const popup = openPopups.get(instanceId)
  return popup !== undefined && !popup.closed
}

export function closePopupWindow(instanceId: string) {
  const popup = openPopups.get(instanceId)
  if (popup && !popup.closed) {
    popup.close()
  }
  openPopups.delete(instanceId)
}
