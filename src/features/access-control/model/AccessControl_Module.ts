import type { AccessScopeType, BulkAccessGrantInput, PutAccessGrantInput } from '@/features/access-control/domain/types/access-control.type'
import type { AccessControl_Service } from '@/features/access-control/model/AccessControl_Service'

export class AccessControl_Module {
  public constructor(private readonly _service: AccessControl_Service) {}

  public searchUsers(query: string, workspaceIdentity?: string, cursor = '', signal?: AbortSignal) {
    return this._service.searchUsers(query, workspaceIdentity, cursor, signal)
  }

  public listGrants(scope: AccessScopeType, workspaceIdentity?: string, query = '', cursor = '', userId = '') {
    return this._service.listGrants(scope, workspaceIdentity, query, cursor, userId)
  }

  public putGrant(input: PutAccessGrantInput) {
    return this._service.putGrant(input)
  }

  public deleteGrant(id: string) {
    return this._service.deleteGrant(id)
  }

  public bulkWorkspaceGrants(input: BulkAccessGrantInput) {
    return this._service.bulkWorkspaceGrants(input)
  }
}
