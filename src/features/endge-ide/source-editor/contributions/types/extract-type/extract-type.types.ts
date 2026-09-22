import type { TypeScriptTypeDeclarationAnalysis } from '@endge/core'

export interface ExtractTypeFolderOption {
  id: string
  name: string
  path: string
}

export interface ExtractTypeDialogItem {
  declaration: TypeScriptTypeDeclarationAnalysis
  sourcePreview: string
}

export interface ExtractTypeDialogInput {
  rootIdentity: string
  items: ExtractTypeDialogItem[]
  folderOptions: ExtractTypeFolderOption[]
}

export interface ExtractTypeDialogResult {
  types: Array<{
    identity: string
    name: string
  }>
  folderId: string | null
}

export interface ExtractTypeCommandTarget {
  declarationStart: number
  sourceVersion: number
}
