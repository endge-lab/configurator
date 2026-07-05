import type { UIAstDocument, UIAstNodeBase } from '@/features/endge-ide/domain/ui/ast/UIAstNode'

import { createUIAstNodeFromDefinition } from '@/features/endge-ide/domain/ui/registry/ui-component-registry'

export function createUIRootNode(input?: {
  id?: string
  propsPatch?: Record<string, unknown>
}): UIAstNodeBase<'page'> {
  return createUIAstNodeFromDefinition({
    id: input?.id ?? 'ui-page-root',
    definitionRef: 'ui.page',
    name: 'Page',
    propsPatch: input?.propsPatch,
  }) as UIAstNodeBase<'page'>
}

export function createUIAstDocument<TNode extends UIAstNodeBase = UIAstNodeBase>(input?: {
  id?: string
  version?: number
  rootNode?: TNode
}): UIAstDocument<TNode> {
  const rootNode = input?.rootNode ?? (createUIRootNode() as TNode)

  return {
    id: input?.id ?? 'ui-document',
    version: input?.version ?? 1,
    rootId: rootNode.id,
    nodes: {
      [rootNode.id]: rootNode,
    },
  }
}
