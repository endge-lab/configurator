export type { UIAstDocument, UIAstNodeBase, UIAstNodeLayout, UIAstNodeReference, UIPrimitiveKind } from '@/features/endge-ide/domain/ui/ast/UIAstNode'
export { createUIAstDocument, createUIRootNode } from '@/features/endge-ide/domain/ui/ast/ui-ast-factories'
export type { UIComponentAssetDocument } from '@/features/endge-ide/domain/ui/assets/UIComponentAsset'
export type { UIComponentConfigDocument } from '@/features/endge-ide/domain/ui/configs/UIComponentConfig'
export type { UIFormConfigDocument } from '@/features/endge-ide/domain/ui/configs/UIFormConfig'
export type { UINavigationConfigDocument } from '@/features/endge-ide/domain/ui/configs/UINavigationConfig'
export type { UITableConfigDocument } from '@/features/endge-ide/domain/ui/configs/UITableConfig'
export type { UIComponentDefinition } from '@/features/endge-ide/domain/ui/definitions/UIComponentDefinition'
export { getUIJsxTagName } from '@/features/endge-ide/domain/ui/jsx/UIJsxComponent'
export type { UIJsxAttributeValue, UIJsxElementNode, UIJsxNode, UIJsxTextNode } from '@/features/endge-ide/domain/ui/jsx/UIJsxComponent'
export type { UIPresentationContract, UIPresentationRoleContract, UIPresentationSurface } from '@/features/endge-ide/domain/ui/presentation/UIPresentationContract'
export {
  BUILTIN_DEFINITIONS,
  UI_COMPONENT_HOST_DEFINITION_ID,
  createUIAstNodeFromDefinition,
  getUIComponentDefinition,
  getUIComponentDefinitionOrThrow,
  getUIDefinitionDefaultLayout,
  getUIDefinitionDefaultProps,
  listUIComponentDefinitionGroups,
  listUIComponentDefinitions,
  normalizeUIAstNodeDefinition,
  resolveLegacyUIDefinitionRef,
} from '@/features/endge-ide/domain/ui/registry/ui-component-registry'
