export type { AccessControl_Module as AccessControlModule } from '@/features/access-control/AccessControl_Module'
export type * from '@/features/access-control/domain/types/access-control.type'
export { createAccessControlModule } from '@/features/access-control/services/access-control'
export { canManageAccess } from '@/features/access-control/services/access-control.policy'
