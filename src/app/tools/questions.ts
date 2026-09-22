import { Configurator } from '@/app/Configurator'

export type { QuestionAnswer as Answer, Question } from '@/app/domain/types/question.type'

/** Тонкий Vue-адаптер над модулем вопросов, принадлежащим приложению. */
export function useQuestions() {
  return {
    ask: Configurator.questions.ask.bind(Configurator.questions),
    questions: Configurator.questions.questions,
  }
}
