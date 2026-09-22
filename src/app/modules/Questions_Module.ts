import type { AnyQuestionAnswer, Question } from '@/app/domain/types/question.type'

import { computed, markRaw, ref } from 'vue'

/** Владеет общей для приложения очередью подтверждений. */
export class Questions_Module {
  private readonly _questions = ref<Question[]>([])
  public readonly questions = computed(() => this._questions.value)

  public async ask<T extends AnyQuestionAnswer>(
    question: Omit<Question<T>, 'resolve' | 'id'>,
  ): Promise<T['value']> {
    return new Promise((resolve) => {
      const id = crypto.randomUUID()
      this._questions.value.push({
        id,
        ...question,
        icon: question.icon ? markRaw(question.icon) : undefined,
        resolve: (value: T['value']) => {
          const index = this._questions.value.findIndex(item => item.id === id)
          if (index >= 0) {
            this._questions.value.splice(index, 1)
          }
          resolve(value)
        },
      })
    })
  }

  public reset(): void {
    this._questions.value = []
  }
}
