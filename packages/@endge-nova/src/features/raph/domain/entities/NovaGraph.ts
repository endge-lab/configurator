import { RaphPhase } from './RaphPhase'
import { RaphProperty } from './RaphProperty'
import { RaphApp } from './RaphApp'
import type {
  RaphPhaseDescriptor,
  RaphPropertyDescriptor,
  RaphProperties,
  RaphPhaseContext,
} from '../types'
import { RaphPropagation } from '../types'
import type { RaphNode } from '@/features/raph/domain/entities/RaphNode'
import {
  extractRaphHandlers,
  extractRaphNodeHandlers,
  extractRaphProperties,
} from '@/features/raph/domain/decorators'

export class NovaGraph {
  /**
   * Для 5 фаз и 120 ФПС
   * 8.33 мс на все фазы (по грязным узлам)
   * То есть максимум 1.66 мс на фазу!
   *
   * Пример расчета конфигурации:
   * - WEIGHT_LIMIT = 1000
   * - MAX_DEPTH = 15
   * - Array[15_000]
   * - Пустой прогон 1 фазы: 0.1-0.5 мс (без run фазы)
   * - Остаток на run фазы: 1.16-1.56 мс!
   *
   * То есть при больших конфигурациях WEIGHT_LIMIT/MAX_DEPTH
   * требуется оптимизация профилирования пустых интервалов в buckets.
   * (Пример: Active Buckets)
   */

  // Меняй, если знаешь, что делаешь! (ядро оптимизации)
  static MAX_UPS = 60 // Maximum updates per second
  static MIN_UPDATE_INTERVAL = 1000 / NovaGraph.MAX_UPS
  static WEIGHT_LIMIT = 100 // 0-99
  static MAX_DEPTH = 5 // 0-4
  static TOTAL_BUCKETS = this.WEIGHT_LIMIT * this.MAX_DEPTH

  // Автоматическая конфигурация приложения на декораторах
  static configure<
    P extends RaphProperties,
    A extends object,
    N extends RaphNode<P>,
  >(
    appCtor: () => A,
    nodeCtor: () => N,
  ): {
    app: RaphApp<P>
    props: { [K in keyof P]: RaphProperty<P, K> }
    phases: { [key: string]: RaphPhase<P> }
  } {
    const appInstance = appCtor()
    const nodeInstance = nodeCtor()

    const handlers = extractRaphHandlers<P>(appInstance)
    const nodeHooks = extractRaphNodeHandlers<P>(nodeInstance)
    const propDescriptors = extractRaphProperties<P>(nodeInstance)

    const phaseMap = new Map<string, Partial<RaphPhaseDescriptor<P>>>()

    // --- Обрабатываем App-хендлеры (process и always)
    for (const { method, phase, always, mode } of handlers) {
      const entry = phaseMap.get(phase) || {}
      entry.process = method ?? NovaGraph.processDirtyNodes
      entry.always = entry.always || always
      entry.mode = mode || 'dirty'
      phaseMap.set(phase, entry)
    }
    console.log(phaseMap)

    // --- Гарантируем фазы для всех props
    for (const prop of propDescriptors) {
      if (!phaseMap.has(prop.phase)) {
        phaseMap.set(prop.phase, {})
      }
    }

    // --- Создаём фазы
    const app = new RaphApp<P>()
    const phases: { [key: string]: RaphPhase<P> } = {}

    for (const [name, entry] of phaseMap.entries()) {
      const phase = new RaphPhase<P>(
        name,
        entry.mode || 'dirty',
        entry.process ?? NovaGraph.processDirtyNodes,
        undefined,
        undefined,
        entry.always ?? false,
      )
      phases[name] = phase
      app.addPhase(phase)
    }

    // --- Устанавливаем afterProcess из NodeHandler
    for (const { phase, methodName } of nodeHooks) {
      const targetPhase = phases[phase]
      if (!targetPhase) continue

      targetPhase.afterProcess = (node, phase) => {
        const fn = node[methodName as keyof RaphNode<P>]
        if (typeof fn === 'function') {
          fn.call(node, phase)
        }
      }
    }

    // --- Создаём и добавляем свойства
    const props: { [K in keyof P]: RaphProperty<P, K> } = {} as any

    for (const {
      name,
      phase,
      compute,
      propagation,
      dependsOn,
      defaultValue,
    } of propDescriptors) {
      const prop = new RaphProperty(
        name,
        phase,
        propagation ?? RaphPropagation.None,
        compute,
        dependsOn,
        defaultValue,
      )
      props[name] = prop
      const targetPhase = phases[phase]
      if (targetPhase) {
        targetPhase.addProperty(prop)
      }
      app.addProperty(prop)
    }

    return { app, props, phases }
  }

  // Конфигурация приложения в ручном режиме
  static configureCustom<
    P extends RaphProperties,
    PD extends readonly RaphPropertyDescriptor<P, keyof P>[],
    FD extends readonly RaphPhaseDescriptor<P>[],
  >(options: {
    properties: PD
    phases: FD
  }): {
    app: RaphApp<P>
    props: { [K in keyof P]: RaphProperty<P, K> }
    phases: { [K in FD[number]['name']]: RaphPhase<P> }
  } {
    const app = new RaphApp<P>()

    const phaseMap = new Map<string, RaphPhase<P>>()
    const phases = {} as { [K in FD[number]['name']]: RaphPhase<P> }

    for (const {
      name,
      process,
      beforeProcess,
      afterProcess,
      always,
    } of options.phases) {
      const phase = new RaphPhase<P>(
        name,
        process ?? NovaGraph.processDirtyNodes,
        beforeProcess,
        afterProcess,
        always || false,
      )
      phaseMap.set(name, phase)
      phases[name as FD[number]['name']] = phase
      app.addPhase(phase)
    }

    const props = {} as { [K in keyof P]: RaphProperty<P, K> }

    for (const {
      name,
      phase,
      compute,
      propagation,
      dependsOn,
    } of options.properties) {
      const prop = new RaphProperty(
        name,
        phase,
        propagation ?? RaphPropagation.None,
        compute,
        dependsOn,
      )
      props[name] = prop
      const targetPhase = phaseMap.get(phase)
      if (targetPhase) {
        targetPhase.addProperty(prop)
      }
      app.addProperty(prop)
    }

    return { app, props, phases }
  }

  static MakeDescriptorComputedLocal<
    Props extends RaphProperties,
    K extends keyof Props,
  >(
    name: K,
    phase: string,
    defaultValue: Props[K],
  ): RaphPropertyDescriptor<Props, K> {
    return {
      name,
      phase,
      propagation: RaphPropagation.None,
      compute: (node: RaphNode<Props>) => node.get(name) ?? defaultValue,
    }
  }

  static MakeDescriptorComputedInheritedBoolean<
    Props extends RaphProperties,
    K extends keyof Props,
  >(
    name: K,
    phase: string,
    defaultValue = true as Props[K],
  ): RaphPropertyDescriptor<Props, K> {
    return {
      name,
      phase,
      propagation: RaphPropagation.Down,
      compute: (node: RaphNode<Props>) =>
        ((node.get(name) ?? defaultValue) &&
          (node.parent?.get(name) ?? true)) as Props[K],
    }
  }

  // Только обработка узла без его иерархии!
  // RaphApp уже учтет иерархию узлов.
  static processDirtyNodes<P extends RaphProperties>(options: {
    payload: RaphPhaseContext<P>
    ignoreCompute?: boolean
  }): void {
    const { payload: p, ignoreCompute } = options

    for (const node of p.dirty) {
      p.phase.beforeProcess?.(node, p.phase)

      if (!ignoreCompute) {
        for (const prop of p.phase.properties) {
          prop.computeOn(node)
        }
      }

      p.phase.afterProcess?.(node, p.phase)
    }
  }
}
