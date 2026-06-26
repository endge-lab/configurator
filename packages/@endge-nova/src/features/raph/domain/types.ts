import type { RaphNode } from '@/features/raph/domain/entities/RaphNode'
import type { RaphPhase } from '@/features/raph/domain/entities/RaphPhase'
import type { RaphProperty } from '@/features/raph/domain/entities/RaphProperty'
import type { RaphApp } from '@/features/raph/domain/entities/RaphApp'

export enum RaphSchedulerType {
  Microtask = 'microtask',
  AnimationFrame = 'animationFrame',
}

export type RaphScheduler = (cb: VoidFunction) => void

/** Название фазы */
export type RaphPhaseName = string

/** Название свойства */
export type RaphPropertyName = string

/** Описание фаз приложения */
export type RaphProperties = Record<RaphPropertyName, unknown> & {
  weight?: number
}

/** Функция обработка грязных узлов */
export type RaphPhaseRunner<P extends RaphProperties> = (
  p: RaphPhaseContext<P>,
) => void

/** Контекст функции обработка грязных узлов */
export interface RaphPhaseContext<P extends RaphProperties> {
  phase: RaphPhase<P>
  root: RaphNode<P>
  dirty: RaphNode<P>[]
}

/** Функция после обработки свойст узлов */
export type RaphNodeCallback<P extends RaphProperties> = (
  node: RaphNode<P>,
  phase: RaphPhase<P>,
) => void

/** NovaGraph.configureCustom результат */
export interface RaphConfiguration<P extends RaphProperties = RaphProperties> {
  app: RaphApp<P>
  props: { [K in keyof P]: RaphProperty<P, K> }
  phases: { [name: string]: RaphPhase<P> }
}

/**
 * Тип распространения свойства.
 * None - только локальный узел.,
 * Down - Все потомки вниз по дереву.
 * */
export enum RaphPropagation {
  None = 'none',
  Down = 'down',
}

/** Интерфейс конфигурации одного свойства */
export interface RaphPropertyDescriptor<
  P extends RaphProperties,
  K extends keyof P,
> {
  name: K
  phase: string
  propagation?: RaphPropagation
  compute: (node: RaphNode<P>) => P[K]
  dependsOn?: (keyof P)[] // для топологической сортировки свойств внутри фазы
  defaultValue: P[K]
}

/** Интерфейс конфигурации одной фазы */
export interface RaphPhaseDescriptor<P extends RaphProperties> {
  name: string
  process?: RaphPhaseRunner<P>
  beforeProcess?: RaphNodeCallback<P>
  afterProcess?: RaphNodeCallback<P>
  always?: boolean
  mode?: 'dirty' | 'all'
}
