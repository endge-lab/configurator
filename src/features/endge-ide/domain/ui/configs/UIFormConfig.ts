import type { UIComponentConfigDocument } from '@/features/endge-ide/domain/ui/configs/UIComponentConfig'

export interface UIFormFieldBinding {
  fieldRef: string
  label?: string
  required?: boolean
}

export interface UIFormConfigData {
  submitActionRef?: string
  fieldBindings: UIFormFieldBinding[]
  layout?: 'stack' | 'grid'
}

export type UIFormConfigDocument = UIComponentConfigDocument<UIFormConfigData> & {
  kind: 'form'
  definitionRef: 'ui.form'
}
