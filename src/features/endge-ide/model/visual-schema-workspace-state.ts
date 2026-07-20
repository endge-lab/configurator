export type VisualSchemaLayoutKey = 'schema' | 'schema-preview' | 'schema-example' | 'schema-preview-example'

export interface VisualSchemaWorkspaceState {
  showPreview: boolean
  showExample: boolean
  layouts: Record<VisualSchemaLayoutKey, number[]>
}

export const VISUAL_SCHEMA_DEFAULT_LAYOUTS: VisualSchemaWorkspaceState['layouts'] = {
  'schema': [1],
  'schema-preview': [0.48, 0.52],
  'schema-example': [0.58, 0.42],
  'schema-preview-example': [0.42, 0.36, 0.22],
}

export function createVisualSchemaWorkspaceState(
  showPreview = false,
  showExample = false,
): VisualSchemaWorkspaceState {
  return {
    showPreview,
    showExample,
    layouts: Object.fromEntries(
      Object.entries(VISUAL_SCHEMA_DEFAULT_LAYOUTS).map(([key, sizes]) => [key, [...sizes]]),
    ) as VisualSchemaWorkspaceState['layouts'],
  }
}

export function isVisualSchemaWorkspaceState(value: unknown): value is VisualSchemaWorkspaceState {
  if (!value || typeof value !== 'object') {
    return false
  }
  const state = value as Partial<VisualSchemaWorkspaceState>
  if (typeof state.showPreview !== 'boolean' || typeof state.showExample !== 'boolean' || !state.layouts) {
    return false
  }
  return Object.entries(VISUAL_SCHEMA_DEFAULT_LAYOUTS).every(([key, fallback]) => {
    const sizes = state.layouts?.[key as VisualSchemaLayoutKey]
    return Array.isArray(sizes)
      && sizes.length === fallback.length
      && sizes.every(size => Number.isFinite(size) && size > 0)
  })
}

export function visualSchemaLayoutKey(
  showPreview: boolean,
  showExample: boolean,
): VisualSchemaLayoutKey {
  if (showPreview && showExample) {
    return 'schema-preview-example'
  }
  if (showPreview) {
    return 'schema-preview'
  }
  if (showExample) {
    return 'schema-example'
  }
  return 'schema'
}
