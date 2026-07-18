import type {
  ProblemsEntityEntry,
  ProblemsSeverityGroup,
} from '@/features/endge-ide/domain/types/problems-workspace.types'
import type {
  DiagnosticsProblem,
  DiagnosticsProblemPhase,
  DiagnosticsProblemSeverity,
} from '@endge/core'

const SEVERITY_ORDER: readonly DiagnosticsProblemSeverity[] = ['fatal', 'error', 'warning', 'info']
const PHASE_ORDER: readonly DiagnosticsProblemPhase[] = ['authoring', 'build', 'runtime']
const SEVERITY_TITLES: Record<DiagnosticsProblemSeverity, string> = {
  fatal: 'Критические',
  error: 'Ошибки',
  warning: 'Предупреждения',
  info: 'Информация',
}

/** Строит стабильный UI-ключ сущности, не зависящий от phase-specific owner. */
function getProblemEntityKey(problem: DiagnosticsProblem): string {
  const ref = problem.owner.entityRef
  if (ref) {
    return `entity:${ref.entityType}:${String(ref.id)}`
  }
  if (problem.owner.runtimeId) {
    return `runtime:${problem.owner.runtimeId}`
  }
  return `owner:${problem.owner.key}`
}

/** Возвращает наиболее серьёзный уровень из набора проблем. */
function getHighestSeverity(problems: readonly DiagnosticsProblem[]): DiagnosticsProblemSeverity {
  return SEVERITY_ORDER.find(severity => problems.some(problem => problem.severity === severity)) ?? 'info'
}

/** Сортирует problems так, чтобы важные и ранние фазы показывались первыми. */
function sortProblems(problems: readonly DiagnosticsProblem[]): DiagnosticsProblem[] {
  return [...problems].sort((left, right) => {
    const severity = SEVERITY_ORDER.indexOf(left.severity) - SEVERITY_ORDER.indexOf(right.severity)
    if (severity !== 0) {
      return severity
    }
    const phase = PHASE_ORDER.indexOf(left.owner.phase) - PHASE_ORDER.indexOf(right.owner.phase)
    if (phase !== 0) {
      return phase
    }
    return left.code.localeCompare(right.code)
  })
}

/** Агрегирует phase-specific owners в одну запись выбранной сущности. */
export function buildProblemsEntityEntries(problems: readonly DiagnosticsProblem[]): ProblemsEntityEntry[] {
  const problemsByEntity = new Map<string, DiagnosticsProblem[]>()

  for (const problem of problems) {
    const key = getProblemEntityKey(problem)
    const current = problemsByEntity.get(key) ?? []
    current.push(problem)
    problemsByEntity.set(key, current)
  }

  return [...problemsByEntity.entries()]
    .map(([key, currentProblems]) => {
      const sortedProblems = sortProblems(currentProblems)
      const first = sortedProblems[0]!
      const entityRef = first.owner.entityRef
      const runtimeId = first.owner.runtimeId
      const phases = PHASE_ORDER.filter(phase => sortedProblems.some(problem => problem.owner.phase === phase))
      return {
        key,
        title: entityRef?.identity ?? runtimeId ?? first.owner.key,
        subtitle: entityRef?.entityType ?? (runtimeId ? 'runtime instance' : first.owner.phase),
        ...(entityRef ? { entityRef } : {}),
        ...(runtimeId ? { runtimeId } : {}),
        highestSeverity: getHighestSeverity(sortedProblems),
        problems: sortedProblems,
        phases,
      }
    })
    .sort((left, right) => left.title.localeCompare(right.title, 'ru'))
}

/** Строит верхний уровень Problems tree по максимальной severity сущности. */
export function buildProblemsSeverityGroups(entries: readonly ProblemsEntityEntry[]): ProblemsSeverityGroup[] {
  return SEVERITY_ORDER.flatMap((severity) => {
    const severityEntries = entries.filter(entry => entry.highestSeverity === severity)
    if (severityEntries.length === 0) {
      return []
    }
    return [{
      severity,
      title: SEVERITY_TITLES[severity],
      problemCount: severityEntries.reduce((total, entry) => total + entry.problems.length, 0),
      entries: severityEntries,
    }]
  })
}
