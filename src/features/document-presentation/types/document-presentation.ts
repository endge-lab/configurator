/** Общие визуальные метаданные документа; не зависят от конкретного экрана. */
export interface DomainDocumentPresentation {
  readonly icon: string
  readonly colorClass: string
  readonly badgeIcon?: string | null
}
