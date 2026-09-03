import type { RVocabs } from '@endge/core'

import { Endge, RMock } from '@endge/core'

export interface PreparedVocabMockGeneration {
  targetIdentity: string
  existingMock: RMock | null
  document: Record<string, unknown>
  vocabs: RVocabs[]
  overwrittenKeys: string[]
}

export interface VocabMockGenerationResult {
  mockIdentity: string
  savedVocabs: string[]
}

/** Загружает raw Payload каждого provider-backed Vocab до начала любых записей. */
export async function prepareVocabMockGeneration(targetIdentity: string): Promise<PreparedVocabMockGeneration> {
  const identity = normalizeIdentity(targetIdentity)
  const existingMock = Endge.domain.getMock(identity)
  const existingDocument = existingMock ? readExistingMock(existingMock) : {}
  const compiled = Endge.domain.getVocabs()
    .filter(vocab => vocab.active !== false && !vocab.deletedAt)
    .map(vocab => ({ vocab, artifact: Endge.compiler.buildVocab(vocab) }))
  const invalid = compiled.find(item => item.artifact.status === 'error')
  if (invalid) {
    const message = invalid.artifact.diagnostics.find(item => item.severity === 'error')?.message ?? 'Source содержит ошибки.'
    throw new Error(`Vocab "${invalid.vocab.identity}" не скомпилирован: ${message}`)
  }
  const vocabs = compiled
    .filter(item => Boolean(item.artifact.payload.provider))
    .map(item => item.vocab)
  if (!vocabs.length) {
    throw new Error('В домене нет активных Vocab с Payload provider.')
  }

  const loaded = await Promise.all(vocabs.map(async (vocab) => {
    const raw = await Endge.vocabs.loadRawVocab(vocab.identity, { limit: 10, throwOnError: true })
    if (!Array.isArray(raw)) {
      throw new TypeError(`Payload Vocab "${vocab.identity}" должен вернуть массив или { docs }.`)
    }
    return [vocab.identity, raw.slice(0, 10)] as const
  }))
  const generated = Object.fromEntries(loaded)
  const overwrittenKeys = Object.keys(generated).filter(key => Object.hasOwn(existingDocument, key))

  return {
    targetIdentity: identity,
    existingMock,
    document: { ...existingDocument, ...generated },
    vocabs,
    overwrittenKeys,
  }
}

/** Сохраняет сначала Mock, затем Vocab по одному; повторный запуск идемпотентен. */
export async function commitVocabMockGeneration(prepared: PreparedVocabMockGeneration): Promise<VocabMockGenerationResult> {
  const mock = prepared.existingMock ?? createMock(prepared.targetIdentity)
  mock.source = JSON.stringify(prepared.document, null, 2)
  mock.contentSource = 'document'
  mock.contentType = 'application/json'

  if (prepared.existingMock) {
    await Endge.domainRepository.saveDocument(prepared.targetIdentity, 'mock', { model: mock })
  }
  else {
    await Endge.domainRepository.createDocument({
      documentType: 'mock',
      identity: prepared.targetIdentity,
      mode: 'model',
      model: mock,
    })
  }

  const savedVocabs: string[] = []
  for (const vocab of prepared.vocabs) {
    const patched = Endge.source.patch('vocab', vocab.source, {
      mock: { identity: prepared.targetIdentity, path: vocab.identity },
    })
    if (!patched.ok) {
      throw partialFailure(prepared.targetIdentity, savedVocabs, vocab.identity, patched.message)
    }
    vocab.source = patched.source
    vocab.sourceVersion = 1
    try {
      await Endge.domainRepository.saveDocument(vocab.identity, 'vocabs', { model: vocab })
      savedVocabs.push(vocab.identity)
    }
    catch (error) {
      throw partialFailure(prepared.targetIdentity, savedVocabs, vocab.identity, error)
    }
  }

  return { mockIdentity: prepared.targetIdentity, savedVocabs }
}

function readExistingMock(mock: RMock): Record<string, unknown> {
  if (mock.contentType !== 'application/json') {
    throw new Error(`Mock "${mock.identity}" должен иметь contentType application/json.`)
  }
  const value = Endge.mock.get(mock.identity)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Mock "${mock.identity}" должен содержать JSON object.`)
  }
  return value as Record<string, unknown>
}

function createMock(identity: string): RMock {
  const mock = new RMock()
  mock.identity = identity
  mock.name = identity
  mock.displayName = identity
  mock.source = '{}'
  return mock
}

function normalizeIdentity(value: string): string {
  const identity = String(value ?? '').trim()
  if (!identity) {
    throw new Error('Укажите identity Mock-документа.')
  }
  if (!/^[A-Z0-9][\w.-]*$/i.test(identity)) {
    throw new Error('Identity Mock может содержать буквы, цифры, точку, дефис и подчёркивание.')
  }
  return identity
}

function partialFailure(mockIdentity: string, savedVocabs: string[], currentIdentity: string, error: unknown): Error {
  const saved = savedVocabs.length ? savedVocabs.join(', ') : 'нет'
  const message = error instanceof Error ? error.message : String(error ?? '')
  return new Error(`Mock "${mockIdentity}" сохранён. Vocab сохранены: ${saved}. Конфликт на "${currentIdentity}": ${message}. Обновите домен и повторите запуск.`)
}
