import type { TypeProgramPayload, TypeSourceDefinition } from '@endge/core'

import { Endge } from '@endge/core'

/** Resolves Type Source for editor-time SFC compilation before or after a full domain build. */
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
