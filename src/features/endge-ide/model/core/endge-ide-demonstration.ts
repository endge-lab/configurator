import type { RuntimeHost } from '@endge/core'
import type { Ref } from 'vue'

import { ComponentType, Endge } from '@endge/core'
import { ref, shallowRef } from 'vue'
import { toast } from 'vue-sonner'

import { showWidget } from '@/components/layouts/grid'

/** Ключ store для демо: queries.<identity запроса> (как при запуске запроса) */
function getStoreBasePath(queryIdentity: string): string {
  return `queries.${queryIdentity}`
}

/** Нормализация ответа запроса: объект/GraphQL → ключи как вкладки (общая логика для инспектора и редактора вида). */
export function normalizeQueryResult(result: unknown): Record<string, unknown[]> {
  if (result !== null && typeof result === 'object' && !Array.isArray(result)) {
    const root = result as Record<string, unknown>
    const dataVal = root.data
    if (dataVal && typeof dataVal === 'object' && !Array.isArray(dataVal)) {
      const nested = dataVal as Record<string, unknown>
      const out: Record<string, unknown[]> = {}
      for (const key of Object.keys(nested)) {
        const val = nested[key]
        if (Array.isArray(val))
          out[key] = val
      }
      if (Object.keys(out).length)
        return out
    }
    const out: Record<string, unknown[]> = {}
    for (const key of Object.keys(root)) {
      const val = root[key]
      if (Array.isArray(val))
        out[key] = val
    }
    if (Object.keys(out).length)
      return out
  }
  return {}
}

/** Данные из раздела «Помощь» (результат запроса) для подстановки в таблицу */
export interface HelpData {
  /** Identity запроса, который выполнили в «Помощи» (используется как ключ queries.<identity>). */
  queryIdentity: string
  resultByKey: Record<string, unknown[]>
  arraySample: unknown | null
  activeTabKey: string
}

const _helpData = shallowRef<HelpData | null>(null)
const _tableRt = ref<RuntimeHost<'table'> | null>(null)
const _tableBasePath = ref<string | null>(null)

/**
 * Подмодуль демонстрации: таблица с данными из «Помощь», виджет «Демонстрация».
 */
export class EndgeIDEDemonstration {
  public init(): void {}
  public reset(): void {
    this.destroyTableRt()
    _helpData.value = null
    _tableBasePath.value = null
  }

  /** Runtime таблицы для виджета (реактивный) */
  get tableRt(): Ref<RuntimeHost<'table'> | null> {
    return _tableRt
  }

  /** Путь в store, по которому зарегистрирована таблица (queries.<identity>) */
  get tableBasePath(): Ref<string | null> {
    return _tableBasePath
  }

  /** Данные демонстрации из раздела «Помощь» (для дополнительных способов рендера). */
  get helpData(): Ref<HelpData | null> {
    return _helpData
  }

  /** Обновить данные из раздела «Помощь» (вызывать из инспектора при выполнении запроса) */
  setHelpData(payload: HelpData | null): void {
    _helpData.value = payload
  }

  /**
   * Выполнить запрос, нормализовать ответ и записать в «Помощь». Используется инспектором и редактором вида.
   */
  async runQueryAndSetHelpData(queryId: string | number): Promise<HelpData | null> {
    const query = Endge.domain.getQuery(queryId)
    if (!query) {
      toast.error('Запрос не найден')
      return null
    }
    try {
      const result = await query.run({})
      let resultByKey: Record<string, unknown[]>
      let arraySample: unknown | null = null
      let activeTabKey: string
      if (Array.isArray(result)) {
        arraySample = result[0] ?? null
        resultByKey = { data: result }
        activeTabKey = 'data'
      }
      else {
        resultByKey = normalizeQueryResult(result)
        const keys = Object.keys(resultByKey)
        activeTabKey = keys[0] ?? ''
      }
      const queryIdentity = String(query.identity ?? '').trim()
      if (!queryIdentity) {
        toast.error('У запроса не задан identity')
        return null
      }
      const payload: HelpData = {
        queryIdentity,
        resultByKey,
        arraySample,
        activeTabKey,
      }
      _helpData.value = payload
      return payload
    }
    catch (e: any) {
      toast.error('Ошибка выполнения запроса', { description: e?.message })
      return null
    }
  }

  /**
   * Выполнить запрос вида, подставить данные в «Помощь» и открыть виджет демонстрации. Вызов из редактора вида.
   */
  async runQueryAndShowTable(queryId: string | number, tableId: string | number): Promise<void> {
    const table = Endge.domain.getComponent(tableId) as { type?: string } | null
    if (!table) {
      toast.error('Компонент не найден')
      return
    }
    if (table.type !== ComponentType.Table) {
      toast.error('Демонстрация доступна только для таблицы. Выберите компонент-таблицу.')
      return
    }
    const help = await this.runQueryAndSetHelpData(queryId)
    if (!help)
      return
    const array = help.resultByKey[help.activeTabKey]
      ?? (help.arraySample != null ? [help.arraySample] : [])
    if (!Array.isArray(array) || !array.length) {
      toast.error('Нет массива данных для отображения.')
      return
    }
    this.showTable(tableId)
  }

  private destroyTableRt(): void {
    if (_tableRt.value) {
      _tableRt.value.destroy?.()
      _tableRt.value = null
    }
    _tableBasePath.value = null
  }

  /**
   * Показать таблицу в виджете: записать данные в store, создать table runtime, открыть виджет.
   * Вызывать из редактора таблицы (кнопка демонстрации).
   */
  showTable(tableId: string | number): void {
    const help = _helpData.value
    if (!help?.queryIdentity || !help?.activeTabKey) {
      toast.error('Нет данных из раздела «Помощь». Выполните запрос в инспекторе.')
      return
    }

    const array = help.resultByKey[help.activeTabKey]
      ?? (help.arraySample != null ? [help.arraySample] : [])
    if (!Array.isArray(array) || !array.length) {
      toast.error('Нет массива данных для отображения.')
      return
    }

    const table = Endge.domain.getComponent(tableId)
    if (!table) {
      toast.error('Таблица не найдена')
      return
    }

    this.destroyTableRt()

    const basePath = getStoreBasePath(help.queryIdentity)
    Endge.store.updateState(basePath, help.resultByKey)

    _tableBasePath.value = basePath
    _tableRt.value = Endge.runtime.execute(table as any, {
      basePath,
    })

    showWidget('demonstration')
  }
}
