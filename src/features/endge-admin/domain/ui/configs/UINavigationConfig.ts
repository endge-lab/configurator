import type { UIComponentConfigDocument } from '@/features/endge-admin/domain/ui/configs/UIComponentConfig'

export interface UINavigationItemConfig {
  id: string
  title: string
  iconRef?: string
  routeRef?: string
}

export interface UINavigationConfigData {
  items: UINavigationItemConfig[]
  collapsible?: boolean
}

export type UINavigationConfigDocument = UIComponentConfigDocument<UINavigationConfigData> & {
  kind: 'navigation'
  definitionRef: 'ui.nav-panel'
}
