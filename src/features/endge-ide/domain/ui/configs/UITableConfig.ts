import type { UIComponentConfigDocument } from '@/features/endge-ide/domain/ui/configs/UIComponentConfig'

export interface UITableColumnConfig {
  key: string
  title: string
  width?: number | string
  rendererRole?: string
  sortable?: boolean
}

export interface UITableConfigData {
  dataSourceRef?: string
  columns: UITableColumnConfig[]
  dense?: boolean
  striped?: boolean
  emptyStateText?: string
}

export type UITableConfigDocument = UIComponentConfigDocument<UITableConfigData> & {
  kind: 'table'
  definitionRef: 'ui.table'
}
