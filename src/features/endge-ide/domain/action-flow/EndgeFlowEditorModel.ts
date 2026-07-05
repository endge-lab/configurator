import type { EndgeFlowDefinition } from '@endge/core'

import { REndgeFlow } from '@endge/core'

export class EndgeFlowEditorModel {
  flow: REndgeFlow = REndgeFlow.createDefault()

  fillFromDefinition(definition: Partial<EndgeFlowDefinition> | null | undefined): void {
    this.flow = REndgeFlow.fromPlain(definition ?? {})
  }

  toDefinition(): EndgeFlowDefinition {
    return this.flow.toPlain()
  }
}
