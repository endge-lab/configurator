export interface UIComponentConfigDocument<TData extends Record<string, unknown> = Record<string, unknown>> {
  id: string
  kind: string
  definitionRef: string
  title: string
  data: TData
}
