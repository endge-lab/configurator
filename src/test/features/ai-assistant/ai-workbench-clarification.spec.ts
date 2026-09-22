import type { AIClarification, AIClarificationCandidate } from '@/features/ai-assistant/domain/types'
import { describe, expect, it } from 'vitest'
import { buildClarificationRunLinkage } from '@/features/ai-assistant/services/clarification'

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

describe('связь уточнений AI', () => {
  it('связывает свободный текст с открытым уточнением', () => {
    expect(buildClarificationRunLinkage(clarification)).toEqual({
      interactionId: 'interaction-1',
      replyToClarificationId: 'clarification-1',
    })
  })

  it('добавляет ID закрытого варианта при выборе варианта', () => {
    expect(buildClarificationRunLinkage(clarification, candidate)).toEqual({
      interactionId: 'interaction-1',
      replyToClarificationId: 'clarification-1',
      selectedCandidateId: 'candidate-1',
    })
  })

  it('создаёт независимый запрос после очистки состояния уточнения', () => {
    expect(buildClarificationRunLinkage(null)).toEqual({})
  })
})
