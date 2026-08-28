import type { AIClarification, AIClarificationCandidate } from '@/features/ai-assistant/domain/types'
import { describe, expect, it } from 'vitest'
import { buildClarificationRunLinkage } from '@/features/ai-assistant/model/clarification'

const clarification: AIClarification = {
  id: 'clarification-1',
  interactionId: 'interaction-1',
  taskId: 'task-1',
  slot: 'entity',
  question: 'Choose an entity',
  candidates: [],
  planVersion: 2,
}

const candidate: AIClarificationCandidate = {
  candidateId: 'candidate-1',
  documentType: 'examples',
  identity: 'example-1',
  displayName: 'Example One',
}

describe('aI clarification linkage', () => {
  it('links free text to the open clarification', () => {
    expect(buildClarificationRunLinkage(clarification)).toEqual({
      interactionId: 'interaction-1',
      replyToClarificationId: 'clarification-1',
    })
  })

  it('adds the closed candidate ID for a candidate click', () => {
    expect(buildClarificationRunLinkage(clarification, candidate)).toEqual({
      interactionId: 'interaction-1',
      replyToClarificationId: 'clarification-1',
      selectedCandidateId: 'candidate-1',
    })
  })

  it('creates an independent request after clarification state is cleared', () => {
    expect(buildClarificationRunLinkage(null)).toEqual({})
  })
})
