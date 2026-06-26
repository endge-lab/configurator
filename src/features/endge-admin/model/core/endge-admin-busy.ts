import { shallowRef } from 'vue'

/** Единый флаг «занятости» для всех асинхронных операций с сущностями (сохранение, удаление, переименование, перемещение). */
export const isBusy = shallowRef(false)

/**
 * Выполняет промис с показом оверлея; в finally сбрасывает isBusy.
 */
export function runBusy<T>(promise: Promise<T>): Promise<T> {
  isBusy.value = true
  return promise.finally(() => {
    isBusy.value = false
  })
}
