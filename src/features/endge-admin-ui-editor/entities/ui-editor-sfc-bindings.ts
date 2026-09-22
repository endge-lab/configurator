import type {
  UIEditorNode,
  UIEditorSFCAttributeBinding,
  UIEditorSFCSourceAttribute,
  UIEditorSFCSourceDirective,
  UIEditorSFCTextSegment,
} from '@/features/endge-admin-ui-editor/modules/ui-editor/domain/types/ui-editor.type'

export const UI_EDITOR_SFC_TEXT_SEGMENTS_META_KEY = 'sfcTextSegments'
export const UI_EDITOR_SFC_CONTENT_PREVIEW_META_KEY = 'sfcContentPreview'
export const UI_EDITOR_SFC_ATTRIBUTE_BINDINGS_META_KEY = 'sfcAttributeBindings'
export const UI_EDITOR_SFC_SOURCE_ATTRIBUTES_META_KEY = 'sfcSourceAttributes'
export const UI_EDITOR_SFC_SOURCE_DIRECTIVES_META_KEY = 'sfcSourceDirectives'
export const UI_EDITOR_SFC_SOURCE_TAG_META_KEY = 'sfcSourceTag'
export const UI_EDITOR_SFC_OPAQUE_SOURCE_META_KEY = 'sfcOpaqueSource'

export function getUIEditorSFCTextSegments(node: UIEditorNode | null | undefined): UIEditorSFCTextSegment[] {
  const value = node?.meta?.[UI_EDITOR_SFC_TEXT_SEGMENTS_META_KEY]
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((segment): segment is UIEditorSFCTextSegment => {
    if (!segment || typeof segment !== 'object') {
      return false
    }
    const candidate = segment as Partial<UIEditorSFCTextSegment>
    return candidate.kind === 'text'
      ? typeof candidate.value === 'string'
      : candidate.kind === 'expression' && typeof candidate.expression === 'string'
  })
}

export function hasUIEditorSFCTextBinding(node: UIEditorNode | null | undefined): boolean {
  return getUIEditorSFCTextSegments(node).some(segment => segment.kind === 'expression')
}

export function getUIEditorSFCContentPreview(node: UIEditorNode | null | undefined): string | null {
  const value = node?.meta?.[UI_EDITOR_SFC_CONTENT_PREVIEW_META_KEY]
  return typeof value === 'string' ? value : null
}

export function getUIEditorSFCAttributeBindings(
  node: UIEditorNode | null | undefined,
): UIEditorSFCAttributeBinding[] {
  const value = node?.meta?.[UI_EDITOR_SFC_ATTRIBUTE_BINDINGS_META_KEY]
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((binding): binding is UIEditorSFCAttributeBinding => {
    if (!binding || typeof binding !== 'object') {
      return false
    }
    const candidate = binding as Partial<UIEditorSFCAttributeBinding>
    return typeof candidate.name === 'string'
      && typeof candidate.expression === 'string'
      && typeof candidate.resolved === 'boolean'
  })
}

export function getUIEditorSFCSourceAttributes(
  node: UIEditorNode | null | undefined,
): UIEditorSFCSourceAttribute[] {
  const value = node?.meta?.[UI_EDITOR_SFC_SOURCE_ATTRIBUTES_META_KEY]
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((attribute): attribute is UIEditorSFCSourceAttribute => {
    if (!attribute || typeof attribute !== 'object') {
      return false
    }
    const candidate = attribute as Partial<UIEditorSFCSourceAttribute>
    return typeof candidate.name === 'string'
      && (candidate.value == null || typeof candidate.value === 'string')
      && typeof candidate.dynamic === 'boolean'
      && typeof candidate.raw === 'string'
  })
}

export function getUIEditorSFCSourceDirectives(
  node: UIEditorNode | null | undefined,
): UIEditorSFCSourceDirective[] {
  const value = node?.meta?.[UI_EDITOR_SFC_SOURCE_DIRECTIVES_META_KEY]
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((directive): directive is UIEditorSFCSourceDirective => {
    if (!directive || typeof directive !== 'object') {
      return false
    }
    const candidate = directive as Partial<UIEditorSFCSourceDirective>
    return typeof candidate.name === 'string'
      && (candidate.argument == null || typeof candidate.argument === 'string')
      && (candidate.expression == null || typeof candidate.expression === 'string')
      && Array.isArray(candidate.modifiers)
      && typeof candidate.raw === 'string'
  })
}

export function getUIEditorSFCSourceTag(
  node: UIEditorNode | null | undefined,
): string | null {
  const value = node?.meta?.[UI_EDITOR_SFC_SOURCE_TAG_META_KEY]
  return typeof value === 'string' && value.trim() ? value : null
}

export function getUIEditorSFCOpaqueSource(
  node: UIEditorNode | null | undefined,
): string | null {
  const value = node?.meta?.[UI_EDITOR_SFC_OPAQUE_SOURCE_META_KEY]
  return typeof value === 'string' && value.trim() ? value : null
}

export function hasUIEditorSFCBinding(node: UIEditorNode | null | undefined): boolean {
  return hasUIEditorSFCTextBinding(node) || getUIEditorSFCAttributeBindings(node).length > 0
}
