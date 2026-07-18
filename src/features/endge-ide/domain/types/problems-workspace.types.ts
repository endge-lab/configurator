import type {
  DiagnosticsEntityRef,
  DiagnosticsProblem,
  DiagnosticsProblemPhase,
  DiagnosticsProblemSeverity,
} from '@endge/core'

/** Идентификатор самостоятельного виджета Problems в левой области IDE. */
export const ENDGE_IDE_PROBLEMS_WIDGET_ID = 'problems'

/** Проблемная сущность, агрегирующая owner-наборы из разных фаз. */
export interface ProblemsEntityEntry {
  key: string
  title: string
  subtitle: string
  entityRef?: DiagnosticsEntityRef
  runtimeId?: string
  highestSeverity: DiagnosticsProblemSeverity
  problems: readonly DiagnosticsProblem[]
  phases: readonly DiagnosticsProblemPhase[]
}

/** Ветка problem-centric дерева, сгруппированная по максимальной severity сущности. */
export interface ProblemsSeverityGroup {
  severity: DiagnosticsProblemSeverity
  title: string
  problemCount: number
  entries: readonly ProblemsEntityEntry[]
}
