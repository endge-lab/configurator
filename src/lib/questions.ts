import { Configurator } from '@/app/model/kernel/configurator'

export type { QuestionAnswer as Answer, Question } from '@/app/domain/types/question.type'

/** Thin Vue-facing adapter over the application-owned questions module. */
export function useQuestions() {
  return {
    ask: Configurator.questions.ask.bind(Configurator.questions),
    questions: Configurator.questions.questions,
  }
}
