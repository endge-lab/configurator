import type {
  LegacyWorkspaceFoldersRebuildRequest,
  LegacyWorkspaceFoldersRebuildResult,
  ServiceBackendLegacyWorkspaceFoldersAdapter,
} from '@/features/endge-ide/domain/types/legacy-workspace-folders.type'

type UnknownRecord = Record<string, unknown>

/** HTTP transport временного Legacy API пересборки Workspace-папок. */
export class ServiceBackendLegacyWorkspaceFoldersHttp_Adapter implements ServiceBackendLegacyWorkspaceFoldersAdapter {
  private readonly _baseURL: string

  public constructor(baseURL: string) {
    this._baseURL = String(baseURL ?? '').trim().replace(/\/+$/, '')
  }

  public async rebuildFromFrontend(request: LegacyWorkspaceFoldersRebuildRequest): Promise<LegacyWorkspaceFoldersRebuildResult> {
    let response: Response
    try {
      response = await fetch(`${this._baseURL}/api/v1/legacy/workspace-folders/rebuild-from-frontend`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Endge-Workspace': request.workspaceIdentity,
        },
        body: JSON.stringify({ confirmation: request.confirmation }),
        signal: request.signal,
      })
    }
    catch (error) {
      if (request.signal?.aborted) {
        throw error
      }
      throw new Error(error instanceof Error ? error.message : 'Backend недоступен')
    }

    const payload = await readJSON(response)
    if (!response.ok) {
      throw new Error(stringValue(payload?.message) || `Backend request failed with ${response.status}`)
    }
    const result = normalizeResult(payload)
    if (!result) {
      throw new Error('Backend вернул некорректный результат пересборки папок')
    }
    return result
  }
}

async function readJSON(response: Response): Promise<UnknownRecord | null> {
  try {
    const value = await response.json()
    return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null
  }
  catch {
    return null
  }
}

function normalizeResult(value: UnknownRecord | null): LegacyWorkspaceFoldersRebuildResult | null {
  if (!value) {
    return null
  }
  const foldersDeleted = nonNegativeInteger(value.foldersDeleted)
  const foldersCreated = nonNegativeInteger(value.foldersCreated)
  const documentsRelinked = nonNegativeInteger(value.documentsRelinked)
  if (foldersDeleted == null || foldersCreated == null || documentsRelinked == null) {
    return null
  }
  return { foldersDeleted, foldersCreated, documentsRelinked }
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
