import { shallowRef } from 'vue'

/** Глобальный флаг загрузки доменной области (bootstrap). Стартуем в состоянии загрузки. */
export const appIsBootstrapping = shallowRef(true)
let pendingBootstrapOps = 0
let initialNavigationSettled = false

function syncLoadingFlag(): void {
  appIsBootstrapping.value = !initialNavigationSettled || pendingBootstrapOps > 0
}

function startBootstrapOperation(): void {
  pendingBootstrapOps += 1
  syncLoadingFlag()
}

function finishBootstrapOperation(): void {
  pendingBootstrapOps = Math.max(0, pendingBootstrapOps - 1)
  syncLoadingFlag()
}

/**
 * Помечает, что первый цикл навигации завершился (успешно или нет).
 * После этого индикатор зависит только от активных bootstrap-операций.
 */
export function markInitialNavigationSettled(): void {
  if (initialNavigationSettled)
    return

  initialNavigationSettled = true
  syncLoadingFlag()
}

/**
 * Аварийный предохранитель: снимает любой зависший индикатор загрузки.
 */
export function forceStopAppLoading(): void {
  initialNavigationSettled = true
  pendingBootstrapOps = 0
  syncLoadingFlag()
}

/**
 * Выполнить промис с индикацией загрузки.
 */
export async function runWithAppLoading<T>(promise: Promise<T>): Promise<T> {
  startBootstrapOperation()
  try {
    return await promise
  }
  finally {
    finishBootstrapOperation()
  }
}
