import type { UIPresentationSurface } from '@/features/endge-admin/domain/ui/presentation/UIPresentationContract'

export interface UIPresentationBinding {
  ownerType: string
  ownerId: string | number
  targetType: 'ui-definition' | 'ui-config' | 'ui-asset' | 'ui-ast-node'
  targetId: string
  role: string
  surface: UIPresentationSurface
  rendererRef: string
  mode: 'replace' | 'append' | 'prepend' | 'disable'
  priority: number
}
