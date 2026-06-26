import type { Component, ComputedRef } from 'vue'

import { computed, markRaw, ref } from 'vue'

export interface Question<T extends AnyAnswer = AnyAnswer> {
  id: string
  title?: string
  text?: string
  description?: string
  icon?: Component
  closable?: boolean
  zIndex?: number
  answers: T[]
  resolve: (value: T['value']) => void
}

export interface Answer<T = unknown> {
  value: T
  text: string
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
}

type AnyAnswer = Answer<any>

const questions = ref<Question[]>([])

export function useQuestions(): {
  /**
   * Asks a question and returns a promise that resolves with the value of the selected answer.
   *
   * @param {Omit<Question, 'resolve'>} q - The question object.
   * @returns A promise that resolves with the value of the selected button.
   *
   * @example
   * ```typescript
   * const result = await ask({
   *   title: 'Confirm Action',
   *   text: 'Are you sure you want to proceed?',
   *   answers: [
   *     { text: 'Yes', variant: 'default', value: true },
   *     { text: 'No', variant: 'secondary', value: false },
   *   ],
   * })
   * // result: boolean
   *
   * const result = await ask({
   *   title: 'How are you?',
   *   text: 'Are you feeling good?',
   *   answers: [
   *     { text: 'Great', value: 'great' as const },
   *     { text: 'Not so good', value: 'not-so-good' as const },
   *     { text: 'Terrible', value: 'terrible' as const },
   *   ],
   * })
   * // result: 'great' | 'not-so-good' | 'terrible'
   * ```
   */
  ask: <T extends AnyAnswer>(q: Omit<Question<T>, 'resolve' | 'id'>) => Promise<T['value']>
  questions: ComputedRef<Question[]>
} {
  async function ask<T extends AnyAnswer>(q: Omit<Question<T>, 'resolve' | 'id'>): Promise<T['value']> {
    return new Promise((resolve) => {
      const id = crypto.randomUUID()
      questions.value.push({
        id,
        ...q,
        icon: q.icon ? markRaw(q.icon) : undefined,
        resolve: (value: T['value']) => {
          const index = questions.value.findIndex(question => question.id === id)
          questions.value.splice(index, 1)
          resolve(value)
        },
      })
    })
  }

  return {
    ask,
    questions: computed(() => questions.value),
  }
}
