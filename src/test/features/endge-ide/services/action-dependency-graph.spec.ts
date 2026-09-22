import { Endge } from '@endge/core'
import { afterEach, describe, expect, it } from 'vitest'

import { buildDocumentDependencyTree } from '@/features/endge-ide/services/document-dependencies/document-dependency-graph'

describe('граф зависимостей Action', () => {
  afterEach(() => {
    Endge.program.clear()
    Endge.domain.reset()
  })

  it('использует зависимости компиляции черновика Action для каждого поддерживаемого executable и transform', () => {
    const result = buildDocumentDependencyTree({
      documentType: 'action',
      id: 'schedule.edit',
      identity: 'schedule.edit',
      displayName: 'Edit schedule',
      source: `defineAction({
  steps: {
    normalized: input('value').dataView('schedule.edit-input').convert('string-trim'),
    validation: computation('schedule.validate', { value: output('normalized') }),
    local: update({ identity: 'schedule.local-update', input: input() }),
    remote: query({ identity: 'schedule.remote-update', input: input() }),
    audit: action({ identity: 'schedule.audit', input: input() }),
  },
  output: output('audit'),
})`,
    })

    expect(result.status).toBe('valid')
    expect(result.root?.children.map(child => child.identity)).toEqual(expect.arrayContaining([
      'schedule.edit-input',
      'string-trim',
      'schedule.validate',
      'schedule.local-update',
      'schedule.remote-update',
      'schedule.audit',
    ]))
  })
})
