import type { DiagnosticsProblem } from '@endge/core'

import { describe, expect, it } from 'vitest'

import {
  buildProblemsEntityEntries,
  buildProblemsSeverityGroups,
} from '@/features/endge-ide/model/diagnostics/problems-workspace-presentation'

function problem(
  id: string,
  phase: DiagnosticsProblem['owner']['phase'],
  severity: DiagnosticsProblem['severity'],
): DiagnosticsProblem {
  return {
    id,
    key: id,
    severity,
    code: `test.${id}`,
    message: id,
    owner: {
      key: `${phase}:${id}`,
      phase,
      entityRef: {
        entityType: 'component-sfc',
        id: 'flight-table',
        identity: 'FlightTable',
      },
    },
    updatedAt: 1,
  }
}

describe('problems workspace presentation', () => {
  it('aggregates one entity across phases and keeps its highest severity', () => {
    const entries = buildProblemsEntityEntries([
      problem('authoring-warning', 'authoring', 'warning'),
      problem('build-error', 'build', 'error'),
    ])

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      title: 'FlightTable',
      highestSeverity: 'error',
      phases: ['authoring', 'build'],
    })
    expect(entries[0]?.problems).toHaveLength(2)
  })

  it('places an entity only in the group of its highest current severity', () => {
    const entries = buildProblemsEntityEntries([
      problem('runtime-warning', 'runtime', 'warning'),
      problem('build-fatal', 'build', 'fatal'),
    ])
    const groups = buildProblemsSeverityGroups(entries)

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      severity: 'fatal',
      problemCount: 2,
    })
    expect(groups[0]?.entries).toHaveLength(1)
  })
})
