import { onScopeDispose, shallowRef, triggerRef, type ShallowRef } from 'vue'

interface SubscribableModule {
  subscribe(listener: () => void): () => void
}

/** Создаёт Vue ref над core Subscribable без копирования module state в configurator store. */
export function useSubscribableModuleRef<T extends SubscribableModule>(module: T): ShallowRef<T> {
  const moduleRef = shallowRef(module) as ShallowRef<T>
  const unsubscribe = module.subscribe(() => triggerRef(moduleRef))
  onScopeDispose(unsubscribe)
  return moduleRef
}
