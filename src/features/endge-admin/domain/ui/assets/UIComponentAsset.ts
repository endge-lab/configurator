import type { UIAstNodeBase } from '@/features/endge-admin/domain/ui/ast/UIAstNode'

export interface UIComponentAssetDocument<TNode extends UIAstNodeBase = UIAstNodeBase> {
  id: string
  title: string
  definitionRef?: string | null
  description?: string
  ast: {
    rootId: string
    nodes: Record<string, TNode>
  }
  defaultConfigRef?: string | null
}
