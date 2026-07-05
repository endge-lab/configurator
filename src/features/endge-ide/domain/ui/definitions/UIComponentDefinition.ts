import type { UIAstNodeLayout, UIPrimitiveKind } from '@/features/endge-ide/domain/ui/ast/UIAstNode'
import type { UIPresentationContract } from '@/features/endge-ide/domain/ui/presentation/UIPresentationContract'

export interface UIComponentDefinition<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string
  title: string
  description: string
  groupId: string
  groupTitle: string
  groupDescription: string
  primitiveKind: UIPrimitiveKind
  jsxTag: string
  supportsChildren: boolean
  paletteVisible: boolean
  canvasAccentClass: string
  keywords?: string[]
  configKind?: string | null
  defaultNodeName: string
  defaultProps: TProps
  defaultLayout?: UIAstNodeLayout
  defaultRendererRef?: string
  allowsRendererRefOverride?: boolean
  stubDescription?: string
  presentationContract: UIPresentationContract
}
