import type { ControllerDefinition, ControllerProgramPayload } from '@endge/core'
import { Endge } from '@endge/core'

// Program metadata is inspectable even when this process cannot execute its provider.
export function mergeControllerDefinitions(
  runtime: readonly ControllerDefinition[],
  program: readonly ControllerDefinition[],
  preferProgram = false,
): ControllerDefinition[] {
  const definitions = new Map(runtime.map(definition => [definition.identity, definition]))
  for (const definition of program) {
    if (preferProgram || !definitions.has(definition.identity)) {
      definitions.set(definition.identity, definition)
    }
  }
  return [...definitions.values()]
}

export function getControllerCatalogDefinitions(): ControllerDefinition[] {
  const program = Endge.program.getArtifacts()
    .filter(artifact => artifact.ref.entityType === 'controller')
    .flatMap((artifact) => {
      const definition = (artifact.payload as ControllerProgramPayload | null)?.definition
      return definition ? [definition] : []
    })
  return mergeControllerDefinitions(Endge.runtime.controllers.list(), program, Endge.mode === 'debugger')
}

export function resolveControllerCatalogDefinition(identity: string): ControllerDefinition | null {
  const runtime = Endge.runtime.controllers.get(identity)
  const program = Endge.program.getArtifact<ControllerProgramPayload>('controller', identity)?.payload.definition
  return Endge.mode === 'debugger' ? program ?? runtime : runtime ?? program ?? null
}
