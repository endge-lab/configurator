import type { ProgramDiagnostic, RQuery } from '@endge/core'

import { Endge } from '@endge/core'

/** Source-only editor model для `RQuery`. */
export class RQueryEditor {
  id!: number
  identity!: string
  name!: string
  source: string = ''
  sourceVersion: number = 2
  diagnostics: unknown[] = []

  fillFromSource(source: RQuery): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.name = source.name
    this.source = source.source ?? ''
    this.sourceVersion = Number(source.sourceVersion ?? 2) || 2
    this.refreshDiagnostics()
  }

  updateSource(target: RQuery): void {
    target.id = this.id
    target.identity = this.identity
    target.name = this.name
    target.displayName = this.name
    target.source = this.source
    target.sourceVersion = 2
  }

  applySourceText(source: string): void {
    this.source = source
    this.refreshDiagnostics()
  }

  private refreshDiagnostics(): void {
    try {
      const result = Endge.source.validate('query', this.source)
      this.diagnostics = result.diagnostics ?? []
    }
    catch (error) {
      this.diagnostics = [createEditorDiagnostic(error)]
    }
  }
}

function createEditorDiagnostic(error: unknown): ProgramDiagnostic {
  return {
    severity: 'error',
    code: 'query-source-editor-diagnostic-error',
    message: error instanceof Error ? error.message : String(error),
    sourcePath: 'source',
  }
}
