import { REntity } from '@endge/core'

export type BuildProfileVisibility = 'shared' | 'private'
export type BuildProfileDiagnostics = 'minimal' | 'standard' | 'detailed'
export type BuildProfileDebuggerStructure = 'complete-catalog' | 'extended-catalog'

export interface BuildProfileSettings {
  includeAst: boolean
  fileFormat: 'gzip' | 'json'
  buildScope: 'complete-model'
  contexts: 'all-contexts'
  diagnostics: BuildProfileDiagnostics
  debuggerStructure: BuildProfileDebuggerStructure
  topology: [{ node: 'frontend', runtime: 'ts-browser' }]
}

export interface BuildProfileTransport {
  id: string
  identity: string
  displayName: string
  visibility: BuildProfileVisibility
  ownerLogin?: string
  settingsVersion: 1
  settings: BuildProfileSettings
  revision: number
  ownedByMe: boolean
  canManage: boolean
  canChangeVisibility: boolean
  createdBy?: { id?: string, username?: string, displayName?: string }
  updatedBy?: { id?: string, username?: string, displayName?: string }
  createdAt?: string
  updatedAt?: string
}

/**
 * App-owned operational build configuration; it is not a Core Domain document.
 */
export class RBuildProfile extends REntity<string> {
  public visibility: BuildProfileVisibility = 'private'
  public ownerLogin = ''
  public settingsVersion = 1 as const
  public settings: BuildProfileSettings = createDefaultBuildProfileSettings()
  public revision = 1
  public ownedByMe = false
  public canManage = false
  public canChangeVisibility = false

  public static fromTransport(value: BuildProfileTransport): RBuildProfile {
    const result = new RBuildProfile()
    result.id = value.id
    result.identity = value.identity
    result.displayName = value.displayName
    result.name = value.displayName
    result.visibility = value.visibility
    result.ownerLogin = value.ownerLogin ?? ''
    result.settingsVersion = 1
    result.settings = cloneBuildProfileSettings(value.settings)
    result.revision = value.revision
    result.ownedByMe = value.ownedByMe
    result.canManage = value.canManage
    result.canChangeVisibility = value.canChangeVisibility
    result.createdAt = value.createdAt
    result.updatedAt = value.updatedAt
    return result
  }

  public apply(value: RBuildProfile): void {
    this.id = value.id
    this.identity = value.identity
    this.displayName = value.displayName
    this.name = value.displayName
    this.visibility = value.visibility
    this.ownerLogin = value.ownerLogin
    this.settingsVersion = 1
    this.settings = cloneBuildProfileSettings(value.settings)
    this.revision = value.revision
    this.ownedByMe = value.ownedByMe
    this.canManage = value.canManage
    this.canChangeVisibility = value.canChangeVisibility
    this.createdAt = value.createdAt
    this.updatedAt = value.updatedAt
  }
}

export function createDefaultBuildProfileSettings(): BuildProfileSettings {
  return {
    includeAst: false,
    fileFormat: 'gzip',
    buildScope: 'complete-model',
    contexts: 'all-contexts',
    diagnostics: 'detailed',
    debuggerStructure: 'complete-catalog',
    topology: [{ node: 'frontend', runtime: 'ts-browser' }],
  }
}

export function cloneBuildProfileSettings(value: BuildProfileSettings): BuildProfileSettings {
  return {
    includeAst: value.includeAst === true,
    fileFormat: value.fileFormat === 'json' ? 'json' : 'gzip',
    buildScope: 'complete-model',
    contexts: 'all-contexts',
    diagnostics: value.diagnostics,
    debuggerStructure: value.debuggerStructure,
    topology: [{ node: 'frontend', runtime: 'ts-browser' }],
  }
}
