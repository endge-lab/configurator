import type { AccessScopeType, BulkAccessGrantInput, PutAccessGrantInput } from '@/features/access-control/domain/types/access-control.type'
import type { AccessControlHttp_Adapter } from '@/features/access-control/model/adapters/AccessControlHttp_Adapter'

export class AccessControl_Module {
  /** HTTP adapter для access-control operations. */
  private readonly _adapter: AccessControlHttp_Adapter

  /**
   * ----------------------------------------
   * PUBLIC
   * ----------------------------------------
   */

  /** Создаёт модуль с явным access-control adapter. */
  public constructor(adapter: AccessControlHttp_Adapter) {
    this._adapter = adapter
  }

  public searchUsers(query: string, workspaceIdentity?: string, cursor = '', signal?: AbortSignal) {
    return this._adapter.searchUsers(query, workspaceIdentity, cursor, signal)
  }

  public listGrants(scope: AccessScopeType, workspaceIdentity?: string, query = '', cursor = '', userId = '') {
    return this._adapter.listGrants(scope, workspaceIdentity, query, cursor, userId)
  }

  public putGrant(input: PutAccessGrantInput) {
    return this._adapter.putGrant(input)
  }

  public deleteGrant(id: string) {
    return this._adapter.deleteGrant(id)
  }

  public bulkWorkspaceGrants(input: BulkAccessGrantInput) {
    return this._adapter.bulkWorkspaceGrants(input)
  }
}
