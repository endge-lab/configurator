import type { DocumentType, DomainSectionType } from '@endge/core'
import type { TreeViewNode } from '@endge/utils'

export interface TreeNode extends TreeViewNode {
  data: string
  isRoot?: boolean
  type: 'folder' | DocumentType
  sectionType: DomainSectionType
  level: number
  children?: TreeNode[]
}
