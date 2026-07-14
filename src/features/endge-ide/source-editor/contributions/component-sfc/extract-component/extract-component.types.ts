export interface ExtractComponentSourceRange {
  start: number
  end: number
}

export interface ExtractComponentDependency {
  propName: string
  sourceExpression: string
  type: string
  paths: string[]
  hasWrite: boolean
}

export interface ExtractableSFCColumn {
  columnRange: ExtractComponentSourceRange
  tagNameEnd: number
  bodyRange: ExtractComponentSourceRange
  columnKey: string | null
  columnTitle: string | null
  bodySource: string
  bodyFingerprint: string
  hasCell: boolean
  dependencies: ExtractComponentDependency[]
}

export interface ExtractComponentDialogInput {
  parentIdentity: string
  suggestedName: string
  suggestedIdentity: string
  suggestedTag: string
  folderOptions: ExtractComponentFolderOption[]
  column: ExtractableSFCColumn
}

export interface ExtractComponentFolderOption {
  id: string
  name: string
  path: string
  depth: number
}

export interface ExtractComponentDialogDependency {
  propName: string
  sourceExpression: string
  type: string
  paths: string[]
}

export interface ExtractComponentDialogResult {
  name: string
  identity: string
  tag: string | null
  folderId: string | null
  dependencies: ExtractComponentDialogDependency[]
}

export interface ExtractColumnCommandTarget {
  columnStart: number
  sourceVersion: number
}
