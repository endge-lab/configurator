import type { RaphProperties } from '@/features/raph/domain/types'
import type { mat3 } from 'gl-matrix'

export interface NovaNodeProperties extends RaphProperties {
  // Фаза - preupdate
  interactive: boolean
  propagateUpdate: boolean

  // Фаза - update
  active: boolean

  // Фаза - matrix
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number

  //
  matrix: mat3

  // Фаза - render
  visible: boolean
  width: number
  height: number
}

export interface NovaAppOptions {
  debug: boolean | string | string[]

  loop: boolean
  width: number
  height: number
}

export interface SurfaceOptions {
  width: number
  height: number
  zIndex: number
  active: boolean
  interactive: boolean
  cache: boolean
}

