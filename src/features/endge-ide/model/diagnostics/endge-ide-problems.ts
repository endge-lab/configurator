import { Endge } from '@endge/core'
import { computed, ref } from 'vue'

import { getLayoutState, showWidget } from '@/components/layouts/grid'
import { ENDGE_IDE_PROBLEMS_WIDGET_ID } from '@/features/endge-ide/domain/types/problems-workspace.types'
import { buildProblemsEntityEntries, buildProblemsSeverityGroups } from '@/features/endge-ide/model/diagnostics/problems-workspace-presentation'

/** Presentation controller самостоятельной рабочей области Problems. */
export class EndgeIDEProblems {
  private readonly _revision = ref(0)
  private _unsubscribe: (() => void) | null = null

  public readonly selectedEntityKey = ref<string | null>(null)
  public readonly entries = computed(() => {
    void this._revision.value
    return buildProblemsEntityEntries(Endge.diagnostics.problems.query())
  })

  public readonly groups = computed(() => buildProblemsSeverityGroups(this.entries.value))
  public readonly selectedEntry = computed(() => {
    return this.entries.value.find(entry => entry.key === this.selectedEntityKey.value) ?? null
  })

  /** Подписывает presentation controller на core registry без копирования problems. */
  public init(): void {
    if (this._unsubscribe) {
      return
    }
    this._unsubscribe = Endge.diagnostics.problems.subscribe(() => {
      this._revision.value += 1
      this._synchronizeSelection()
    })
    this._synchronizeSelection()
  }

  /** Отписывает controller и очищает только configurator selection. */
  public reset(): void {
    this._unsubscribe?.()
    this._unsubscribe = null
    this.selectedEntityKey.value = null
    this._revision.value = 0
  }

  /** Выбирает проблемную сущность для отображения в основной части workspace. */
  public selectEntity(entityKey: string): void {
    if (this.entries.value.some(entry => entry.key === entityKey)) {
      this.selectedEntityKey.value = entityKey
    }
  }

  /** Возвращает пользователя из Problems workspace к Project widget. */
  public returnToProject(): boolean {
    const area = getLayoutState().widgets.value.areas.left
    if (!area.expanded || area.activeWidget !== ENDGE_IDE_PROBLEMS_WIDGET_ID) {
      return false
    }
    showWidget('project')
    return true
  }

  /** Сохраняет selection, пока сущность существует, иначе выбирает первую проблемную сущность. */
  private _synchronizeSelection(): void {
    const selectedExists = this.entries.value.some(entry => entry.key === this.selectedEntityKey.value)
    if (!selectedExists) {
      this.selectedEntityKey.value = this.entries.value[0]?.key ?? null
    }
  }
}
