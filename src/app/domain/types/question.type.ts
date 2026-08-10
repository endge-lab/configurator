import type { Component } from 'vue'

export interface QuestionAnswer<T = unknown> {
  value: T
  text: string
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
}

export type AnyQuestionAnswer = QuestionAnswer<any>

export interface Question<T extends AnyQuestionAnswer = AnyQuestionAnswer> {
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
