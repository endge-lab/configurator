import type { RMock, RMockContentSource, RMockContentType } from '@endge/core'

import { Endge } from '@endge/core'

/** Editor model persisted mock-документа. */
export class RMockEditor {
  id!: string | number
  identity!: string
  name!: string
  description: string = ''
  contentSource: RMockContentSource = 'document'
  contentType: RMockContentType = 'application/json'
  source: string = '{}'
  codeRef: string = ''
  diagnostics: string[] = []

  /** Заполняет editor state из RMock. */
  fillFromSource(source: RMock): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.name = source.displayName ?? source.name ?? this.identity
    this.description = String(source.description ?? '')
    this.contentSource = source.contentSource
    this.contentType = source.contentType
    this.source = String(source.source ?? '{}')
    this.codeRef = String(source.codeRef ?? '')
    this.refreshDiagnostics()
  }

  /** Переносит editor state обратно в persisted RMock. */
  updateSource(target: RMock): void {
    target.id = this.id as any
    target.identity = this.identity.trim()
    target.name = this.name.trim() || target.identity
    target.displayName = target.name
    target.description = this.description.trim() || null
    target.contentSource = this.contentSource
    target.contentType = this.contentType
    target.source = this.source
    target.codeRef = this.codeRef.trim() || null
  }

  /** Обновляет source и diagnostics. */
  applySourceText(value: string): void {
    this.source = value
    this.refreshDiagnostics()
  }

  /** Проверяет текущий editor state без мутации доменной модели. */
  refreshDiagnostics(): void {
    const diagnostics: string[] = []
    if (!this.identity.trim()) {
      diagnostics.push('Identity не может быть пустым.')
    }
    if (this.contentSource === 'code-provider') {
      if (!this.codeRef.trim()) {
        diagnostics.push('Для code-provider необходимо указать codeRef.')
      }
      else if (!Endge.mock.listProviders().some(provider => provider.ref === this.codeRef.trim())) {
        diagnostics.push(`Provider "${this.codeRef.trim()}" не подключен в текущем runtime.`)
      }
    }
    else if (this.contentType === 'application/json') {
      try {
        JSON.parse(this.source)
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        diagnostics.push(`Некорректный JSON: ${message}`)
      }
    }
    this.diagnostics = diagnostics
  }
}
