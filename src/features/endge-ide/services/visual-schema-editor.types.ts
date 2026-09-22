export interface VisualSchemaTypeOption {
  identity: string
  label: string
  category: 'primitive' | 'reference' | 'user'
  source?: string
}

export interface VisualSchemaDiagnostic {
  severity: 'error' | 'warning' | 'info'
  code: string
  message: string
}
