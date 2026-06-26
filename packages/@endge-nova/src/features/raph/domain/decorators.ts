import 'reflect-metadata'
import type {
  RaphPhaseName,
  RaphPhaseRunner,
  RaphProperties,
  RaphPropertyDescriptor,
} from '@/features/raph/domain/types'
import { RaphPropagation } from '@/features/raph/domain/types'

const PROP_METADATA_KEY = Symbol('raph:property')
const HANDLER_METADATA_KEY = Symbol('raph:handler')

export interface RaphPropertyOptions {
  phase: RaphPhaseName
  default: any
  propagation?: RaphPropagation
  dependsOn?: string[]
  compute?: (self: any) => any
}

export interface RaphHandlerOptions {
  name?: RaphPhaseName
  always?: boolean
  priority?: number
  mode?: 'dirty' | 'all'
}

const NODE_HANDLER_METADATA_KEY = Symbol('raph:node-handler')

export interface RaphNodeHandlerOptions {
  phase: RaphPhaseName
}

// --- Декоратор для метода узла
export function RaphAfter(options: RaphNodeHandlerOptions): MethodDecorator {
  return (target, propertyKey) => {
    const handlers: Map<RaphPhaseName, string> =
      Reflect.getMetadata(NODE_HANDLER_METADATA_KEY, target.constructor) ||
      new Map()

    handlers.set(options.phase, propertyKey.toString())
    Reflect.defineMetadata(
      NODE_HANDLER_METADATA_KEY,
      handlers,
      target.constructor,
    )
  }
}

// --- Извлечение всех хендлеров из узла (только имена методов)
export function extractRaphNodeHandlers(
  instance: any,
): { phase: RaphPhaseName; methodName: string }[] {
  const ctor = instance.constructor
  const raw = Reflect.getMetadata(NODE_HANDLER_METADATA_KEY, ctor) as Map<
    RaphPhaseName,
    string
  >

  if (!raw) return []

  const result: { phase: RaphPhaseName; methodName: string }[] = []

  for (const [phase, methodName] of raw.entries()) {
    result.push({ phase, methodName })
  }

  return result
}

// --- Декоратор свойства
export function RaphProperty(options: RaphPropertyOptions): PropertyDecorator {
  return (target, propertyKey) => {
    const props: Map<string | symbol, RaphPropertyOptions> =
      Reflect.getMetadata(PROP_METADATA_KEY, target.constructor) || new Map()
    props.set(propertyKey, options)
    Reflect.defineMetadata(PROP_METADATA_KEY, props, target.constructor)
  }
}

// --- Декоратор хендлера (метод узла или App)
export function RaphPhase(options: RaphHandlerOptions = {}): MethodDecorator {
  return (target, propertyKey) => {
    const handlers: Map<string | symbol, RaphHandlerOptions> =
      Reflect.getMetadata(HANDLER_METADATA_KEY, target.constructor) || new Map()
    handlers.set(propertyKey, {
      ...options,
      name: options.name ?? propertyKey.toString(),
      mode: options.mode ?? 'dirty',
    })
    Reflect.defineMetadata(HANDLER_METADATA_KEY, handlers, target.constructor)
  }
}

// --- Извлечение всех свойств
export function extractRaphProperties<P extends RaphProperties>(
  instance: any,
): RaphPropertyDescriptor<P, keyof P>[] {
  const ctor = instance.constructor
  const raw = Reflect.getMetadata(PROP_METADATA_KEY, ctor) as Map<
    string | symbol,
    RaphPropertyOptions
  >
  if (!raw) return []

  const result: RaphPropertyDescriptor<P, keyof P>[] = []

  for (const [key, options] of raw.entries()) {
    const name = key as keyof P
    const phase = options.phase
    const propagation = options.propagation ?? RaphPropagation.None
    const dependsOn = options.dependsOn ?? []
    const defaultValue = options.default

    let compute: ((self: any) => any) | undefined = options.compute

    if (!compute) {
      if (propagation === RaphPropagation.Down) {
        compute = (self: any) =>
          (self.get(name) ?? defaultValue ?? true) &&
          (self.parent?.get(name) ?? true)
      } else {
        compute = (self: any) => self.get(name) ?? defaultValue
      }
    }

    result.push({
      name,
      phase,
      propagation,
      dependsOn,
      defaultValue,
      compute,
    })
  }

  return result
}

// --- Извлечение всех хендлеров
export function extractRaphHandlers<P extends RaphProperties>(
  instance: any,
): {
  method: RaphPhaseRunner<P>
  phase: RaphPhaseName
  priority: number
  always: boolean
  mode: string
}[] {
  const ctor = instance.constructor
  const raw = Reflect.getMetadata(HANDLER_METADATA_KEY, ctor) as Map<
    string | symbol,
    RaphHandlerOptions
  >
  if (!raw) return []

  const result: {
    method: RaphPhaseRunner<P>
    phase: RaphPhaseName
    priority: number
    always: boolean
    mode: string
  }[] = []

  for (const [key, options] of raw.entries()) {
    result.push({
      method: instance[key as keyof typeof instance].bind(instance),
      phase: options.name ?? key.toString(),
      priority: options.priority ?? 0,
      always: options.always ?? false,
      mode: options.mode ?? 'dirty',
    })
  }

  // Сортировка по приоритету (по возрастанию)
  result.sort((a, b) => a.priority - b.priority)

  return result
}
