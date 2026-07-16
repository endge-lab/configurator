import type { RComputation } from '@endge/core'

import { RField } from '@endge/core'

/** Editor state for a persisted Computation document. */
export class RComputationEditor {
  id!: string | number
  identity!: string
  name!: string
  description: string = ''
  source: string = ''
  sourceVersion: number = 1
  contractVersion: number = 1
  inputType: string = ''
  inputIsArray: boolean = false
  inputOptional: boolean = false
  outputType: string = ''
  outputIsArray: boolean = false
  outputOptional: boolean = false
  diagnostics: string[] = []

  fillFromSource(source: RComputation): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.name = source.displayName ?? source.name ?? this.identity
    this.description = String(source.description ?? '')
    this.source = String(source.source ?? '')
    this.sourceVersion = source.sourceVersion
    this.contractVersion = source.contractVersion
    this.inputType = source.input?.type ?? ''
    this.inputIsArray = source.input?.isArray === true
    this.inputOptional = source.input?.optional === true
    this.outputType = source.output?.type ?? ''
    this.outputIsArray = source.output?.isArray === true
    this.outputOptional = source.output?.optional === true
    this.refreshDiagnostics()
  }

  updateSource(target: RComputation): void {
    target.id = this.id as any
    target.identity = this.identity.trim()
    target.name = this.name.trim() || target.identity
    target.displayName = target.name
    target.description = this.description.trim() || null
    target.source = this.source
    target.sourceVersion = Math.max(1, Number(this.sourceVersion) || 1)
    target.contractVersion = Math.max(1, Number(this.contractVersion) || 1)
    target.input = this.inputType.trim()
      ? new RField('input', this.inputType.trim(), this.inputIsArray, this.inputOptional)
      : null
    target.output = this.outputType.trim()
      ? new RField('output', this.outputType.trim(), this.outputIsArray, this.outputOptional)
      : null
  }

  applySourceText(value: string): void {
    this.source = value
    this.refreshDiagnostics()
  }

  refreshDiagnostics(): void {
    const diagnostics: string[] = []
    if (!this.identity.trim()) {
      diagnostics.push('Identity не может быть пустым.')
    }
    if (!this.source.trim()) {
      diagnostics.push('Source не может быть пустым.')
    }
    if (!Number.isInteger(Number(this.sourceVersion)) || Number(this.sourceVersion) < 1) {
      diagnostics.push('sourceVersion должен быть целым числом больше нуля.')
    }
    if (!Number.isInteger(Number(this.contractVersion)) || Number(this.contractVersion) < 1) {
      diagnostics.push('contractVersion должен быть целым числом больше нуля.')
    }
    this.diagnostics = diagnostics
  }
}
