import { Endge } from '@endge/core'

/** Выполняет transient Computation source на JSON-входе редактора. */
export async function runComputationSourcePreview(
  source: string,
  inputSource: string,
  identity: string,
): Promise<unknown> {
  const input = JSON.parse(inputSource || '{}')
  return Endge.runtime.computation.runSource(
    source,
    input,
    identity.trim() || 'computation-editor-preview',
  )
}

/** Сериализует результат preview в стабильный JSON для правой панели. */
export function serializeComputationPreviewOutput(output: unknown): string {
  return JSON.stringify(output, null, 2) ?? 'null'
}
