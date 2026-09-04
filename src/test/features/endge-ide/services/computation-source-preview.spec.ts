import { describe, expect, it } from 'vitest'

import {
  runComputationSourcePreview,
  serializeComputationPreviewOutput,
} from '@/features/endge-ide/services/computation-preview/computation-source-preview'

describe('предварительное выполнение Source в редакторе Computation', () => {
  it('выполняет черновик с объектом на входе', async () => {
    await expect(runComputationSourcePreview(
      `defineComputation({
        outputs: {
          result: {
            value: input('value').trim(),
            active: input('active').defaultTo(false),
          },
        },
        result: output('result'),
      })`,
      '{ "value": " preview ", "active": true }',
      'editor-preview-test',
    )).resolves.toEqual({
      value: 'preview',
      active: true,
    })
  })

  it('принимает скалярный JSON на входе, поскольку контракты Computation могут быть скалярными', async () => {
    await expect(runComputationSourcePreview(
      `defineComputation({
        outputs: { result: input('') },
        result: output('result'),
      })`,
      '42',
      'scalar-preview-test',
    )).resolves.toBe(42)
  })

  it('сериализует undefined на выходе как JSON null', () => {
    expect(serializeComputationPreviewOutput(undefined)).toBe('null')
    expect(serializeComputationPreviewOutput({ value: 1 })).toBe(`{
  "value": 1
}`)
  })
})
