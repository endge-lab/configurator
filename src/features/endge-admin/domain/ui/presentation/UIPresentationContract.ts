export type UIPresentationSurface = 'canvas' | 'admin' | 'runtime'

export interface UIPresentationRoleContract {
  role: string
  description: string
  supportedSurfaces: UIPresentationSurface[]
  defaultRendererRefs?: Partial<Record<UIPresentationSurface, string>>
}

export interface UIPresentationContract {
  id: string
  roles: UIPresentationRoleContract[]
}
