import type {
  UIEditorNode,
  UIEditorSFCAttributeBinding,
  UIEditorSFCTextSegment,
} from '@/features/endge-admin-ui-editor/types'

export const UI_EDITOR_SFC_TEXT_SEGMENTS_META_KEY = 'sfcTextSegments'
export const UI_EDITOR_SFC_CONTENT_PREVIEW_META_KEY = 'sfcContentPreview'
export const UI_EDITOR_SFC_ATTRIBUTE_BINDINGS_META_KEY = 'sfcAttributeBindings'

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

export function hasUIEditorSFCBinding(node: UIEditorNode | null | undefined): boolean {
  return hasUIEditorSFCTextBinding(node) || getUIEditorSFCAttributeBindings(node).length > 0
}
