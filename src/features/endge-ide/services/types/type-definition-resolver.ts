import type { TypeProgramPayload, TypeSourceDefinition } from '@endge/core'

import { Endge } from '@endge/core'

/** Определяет Type Source для компиляции SFC в редакторе до или после полной сборки домена. */
export function resolveEndgeTypeDefinition(identity: string): TypeSourceDefinition | null {
  const compiled = Endge.program.getTypeArtifact(identity)?.payload.definition
  if (compiled) {
    return compiled
  }

  const type = Endge.domain.getType(identity)
  if (!type || type.isPrimitive) {
    return null
  }
  const result = Endge.source.compile('type', type.source)
  return (result.artifact as TypeProgramPayload | undefined)?.definition ?? null
}
