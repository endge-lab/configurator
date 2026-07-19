import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import type { ProjectTab } from '@endge/core/domain/types/types'
import { useDomainStore } from '@endge/ui-vue'

export const useProjectsStore = defineStore('endge-project-store', () => {
  const domainStore = useDomainStore()

  /**
   * Реальные проекты приходят из домена.
   */
  const projects = computed<ProjectTab[]>(() => domainStore.projects)

  /**
   * Локальный порядок отображения проектов.
   * Сначала берём из домена, но потом UI может менять порядок.
   */
  const visibleOrder = ref<string[]>([])

  /**
   * Инициализация: когда domainStore загрузил проекты -  фиксируем порядок.
   */
  watch(
    projects,
    (list) => {
      if (visibleOrder.value.length === 0 && list.length > 0) {
        visibleOrder.value = list.map((p) => p.id)
      }
    },
    { immediate: true },
  )

  /**
   * Активный проект
   */
  const activeProjectId = ref<string | null>(null)

  watch(
    projects,
    (list) => {
      if (!activeProjectId.value && list.length > 0) {
        activeProjectId.value = list[0].id
      }
    },
    { immediate: true },
  )

  const activeProject = computed<ProjectTab | null>(() => {
    return projects.value.find((p) => p.id === activeProjectId.value) ?? null
  })

  function setActiveProject(id: string) {
    if (projects.value.some((p) => p.id === id)) {
      activeProjectId.value = id
    }
  }

  /**
   * Закрытие проекта (UI-семантика)
   */
  function closeProject(id: string) {
    const idx = visibleOrder.value.indexOf(id)
    if (idx === -1) return

    const closingIsActive = activeProjectId.value === id

    visibleOrder.value.splice(idx, 1)

    if (!closingIsActive) return

    if (visibleOrder.value.length === 0) {
      activeProjectId.value = null
      return
    }

    const nextId =
      visibleOrder.value[idx] ??
      visibleOrder.value[idx - 1] ??
      visibleOrder.value[0]

    activeProjectId.value = nextId
  }

  /**
   * Перестановка проектов в UI (drag’n’drop)
   */
  function reorderProjects(newOrder: ProjectTab[]) {
    const ids = newOrder.map((p) => p.id)

    // фильтруем только те, что реально существуют в projects
    const existing = new Set(projects.value.map((p) => p.id))
    visibleOrder.value = ids.filter((id) => existing.has(id))
  }

  /**
   * Список проектов в UI-порядке
   */
  const orderedProjects = computed<ProjectTab[]>(() => {
    const byId = new Map(projects.value.map((p) => [p.id, p]))

    return visibleOrder.value
      .map((id) => byId.get(id))
      .filter((p): p is ProjectTab => !!p)
  })

  return {
    projects,
    orderedProjects,
    activeProjectId,
    activeProject,

    setActiveProject,
    closeProject,
    reorderProjects,
  }
})
