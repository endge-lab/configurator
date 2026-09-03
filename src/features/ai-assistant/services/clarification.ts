import type { AIClarification, AIClarificationCandidate } from '@/features/ai-assistant/domain/types'

export interface AIClarificationRunLinkage {
  interactionId: string
  replyToClarificationId: string
  selectedCandidateId?: string
}

export function buildClarificationRunLinkage(
  clarification: AIClarification | null,
  selectedCandidate?: AIClarificationCandidate,
): Partial<AIClarificationRunLinkage> {
  if (!clarification) {
    return {}
  }
  return {
    interactionId: clarification.interactionId,
    replyToClarificationId: clarification.id,
    ...(selectedCandidate ? { selectedCandidateId: selectedCandidate.candidateId } : {}),
  }
}
