export type { UIAstDocument, UIAstNodeBase, UIAstNodeLayout, UIAstNodeReference, UIPrimitiveKind } from '@/features/endge-admin/domain/ui/ast/UIAstNode'
export { createUIAstDocument, createUIRootNode } from '@/features/endge-admin/domain/ui/ast/ui-ast-factories'
export type { UIComponentAssetDocument } from '@/features/endge-admin/domain/ui/assets/UIComponentAsset'
export type { UIComponentConfigDocument } from '@/features/endge-admin/domain/ui/configs/UIComponentConfig'
export type { UIFormConfigDocument } from '@/features/endge-admin/domain/ui/configs/UIFormConfig'
export type { UINavigationConfigDocument } from '@/features/endge-admin/domain/ui/configs/UINavigationConfig'
export type { UITableConfigDocument } from '@/features/endge-admin/domain/ui/configs/UITableConfig'
export type { UIComponentDefinition } from '@/features/endge-admin/domain/ui/definitions/UIComponentDefinition'
export { getUIJsxTagName } from '@/features/endge-admin/domain/ui/jsx/UIJsxComponent'
export type { UIJsxAttributeValue, UIJsxElementNode, UIJsxNode, UIJsxTextNode } from '@/features/endge-admin/domain/ui/jsx/UIJsxComponent'
export type { UIPresentationBinding } from '@/features/endge-admin/domain/ui/presentation/UIPresentationBinding'
export type { UIPresentationContract, UIPresentationRoleContract, UIPresentationSurface } from '@/features/endge-admin/domain/ui/presentation/UIPresentationContract'
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
} from '@/features/endge-admin/domain/ui/registry/ui-component-registry'
