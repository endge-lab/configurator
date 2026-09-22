import type {
  ComponentSFCTableVisualCellTag,
  RComponentContractInput,
} from '@endge/core'

/** Встроенные tags, которые могут использоваться как редактор ячейки. */
export const TABLE_CELL_EDITOR_TAGS = [
  'Text',
  'DateTime',
  'Number',
  'Input',
  'Textarea',
  'Checkbox',
  'Select',
] as const satisfies readonly ComponentSFCTableVisualCellTag[]

/** Search option и публичный props contract компонента ячейки SFC. */
export interface TableCellComponentOption {
  value: string
  label: string
  inputs: RComponentContractInput[]
  /** Компонент можно выбрать как редактор значения. */
  editorEligible: boolean
}

export type TableCellBindingValueKind = 'expression' | 'literal'
