import type {
  RaphNodeCallback,
  RaphPhaseName,
  RaphPhaseRunner,
  RaphProperties,
} from '@/features/raph/domain/types'
import type { RaphProperty } from '@/features/raph/domain/entities/RaphProperty'

/**
 * Фаза обработки узлов в системе RAPH.
 * Каждая фаза отвечает за перерасчет определенных свойств или состояний.
 */
export class RaphPhase<P extends RaphProperties = RaphProperties> {
  properties: RaphProperty<P, any>[] = []

  /**
   * @param name Уникальное имя фазы
   * @param mode в метод run попадут либо грязные узлы, либо все
   * @param run Функция, которая получает массив грязных узлов и выполняет обновление
   * @param beforeProcess - обработчики нод до/после обработки свойств
   * @param afterProcess
   * @param always - запускать для root всегда?
   */
  constructor(
    public readonly name: RaphPhaseName,
    public readonly mode: 'dirty' | 'all',
    public readonly run: RaphPhaseRunner<P>,
    public readonly beforeProcess?: RaphNodeCallback<P>,
    public readonly afterProcess?: RaphNodeCallback<P>,
    public readonly always?: boolean,
  ) {}

  addProperty(prop: RaphProperty<P, any>): void {
    this.properties.push(prop)
  }

  finalize(): void {
    const sorted: RaphProperty<P, any>[] = []
    const visited = new Set<string>()
    const temp = new Set<string>()
    const map = new Map<string, RaphProperty<P, any>>()

    for (const p of this.properties) map.set(p.name as string, p)

    const visit = (name: string): void => {
      if (visited.has(name)) return
      if (temp.has(name)) {
        throw new Error(`[RaphPhase] Circular dependency: "${name}"`)
      }
      temp.add(name)

      const prop = map.get(name)
      if (!prop) return

      for (const dep of prop.dependsOn || []) {
        visit(dep as string)
      }

      temp.delete(name)
      visited.add(name)
      sorted.push(prop)
    }

    for (const p of this.properties) visit(p.name as string)

    this.properties = sorted
  }
}
