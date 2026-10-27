import type { SourceEngineCompileResult } from '@endge/core'

import { Endge } from '@endge/core'

/**
 * Компиляция Source для предпросмотров (artifact, preview, панель запуска) с контекстом
 * текущего boot: facet()/config()/context()/contextSwitch берут выбранный тенант, а не
 * default-ветки. До разрешения Configuration — как обычный compile.
 * Анализ зависимостей и визуальные редакторы, которым нужны все ветки, используют
 * `Endge.source.compile` без контекста.
 */
export function compilePreviewSource(sourceKind: string, source: string): SourceEngineCompileResult {
  const sourceContext = Endge.source.currentSourceContext() ?? undefined
  return Endge.source.compile(sourceKind, source, sourceContext ? { sourceContext } : undefined)
}
