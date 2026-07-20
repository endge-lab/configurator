import type { RComponentContractInput } from '@endge/core'

/** Search option и публичный props contract компонента ячейки SFC. */
export interface TableCellComponentOption {
  value: string
  label: string
  inputs: RComponentContractInput[]
}

export type TableCellBindingValueKind = 'expression' | 'literal'
