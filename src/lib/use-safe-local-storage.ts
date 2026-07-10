import type { RemovableRef, StorageLike, UseStorageOptions } from '@vueuse/core'
import { useStorage } from '@vueuse/core'

let safeLocalStorage: StorageLike | undefined

function getSafeLocalStorage(): StorageLike | undefined {
  if (typeof window === 'undefined')
    return undefined

  if (!safeLocalStorage) {
    const storage = window.localStorage

    safeLocalStorage = {
      getItem: key => storage.getItem(key),
      setItem: (key, value) => storage.setItem(key, value),
      removeItem: key => storage.removeItem(key),
    }
  }

  return safeLocalStorage
}

export function useSafeLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: UseStorageOptions<T>,
): RemovableRef<T> {
  return useStorage(key, initialValue, getSafeLocalStorage(), options)
}
