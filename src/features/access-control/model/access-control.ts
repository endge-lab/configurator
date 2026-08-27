import { AccessControl_Module } from '@/features/access-control/model/AccessControl_Module'
import { AccessControlHttp_Adapter } from '@/features/access-control/model/adapters/AccessControlHttp_Adapter'

/** Создаёт access-control module graph для выбранного backend. */
export function createAccessControlModule(baseURL: string): AccessControl_Module {
  return new AccessControl_Module(new AccessControlHttp_Adapter(baseURL))
}
