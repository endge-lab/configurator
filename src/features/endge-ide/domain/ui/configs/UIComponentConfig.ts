export interface UIComponentConfigDocument<TData extends object = Record<string, unknown>> {
  id: string
  kind: string
  definitionRef: string
  title: string
  data: TData
}
