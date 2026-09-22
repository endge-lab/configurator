import type { SimulationSourceArtifact } from '@endge/core'
import type { RuntimePreviewLaunchRequest } from '@/features/endge-ide/domain/types/runtime-preview.types'

import { Endge, RSimulation } from '@endge/core'

export interface RuntimePreviewContextValidation {
  valid: boolean
  message?: string
  description?: string
}

export function validateRuntimePreviewContext(
  target: RuntimePreviewLaunchRequest,
  isSwitchingContext = false,
): RuntimePreviewContextValidation {
  if (isSwitchingContext) {
    return {
      valid: false,
      message: 'Контекст приложения переключается',
      description: 'Дождитесь завершения перекомпиляции и повторите запуск.',
    }
  }

  if (target.entityType === 'simulation') {
    const artifact = target.draft
      ? Endge.compiler.compileSimulationArtifact(Object.assign(new RSimulation(), {
          ...Endge.domain.getSimulation(target.identity),
          ...target.draft,
          identity: target.identity,
        }))
      : Endge.program.getArtifact<SimulationSourceArtifact>('simulation', target.identity)
    if (!artifact || artifact.status === 'error') {
      return { valid: false, message: 'Simulation содержит ошибки', description: artifact?.diagnostics.find(item => item.severity === 'error')?.message }
    }
    return validateRuntimePreviewContext(artifact.payload.target)
  }

  if (target.entityType !== 'composition') {
    return { valid: true }
  }

  const composition = Endge.domain.getComposition(target.identity)
  if (!composition) {
    return {
      valid: false,
      message: 'Композиция недоступна',
      description: `Документ «${target.identity}» отсутствует в текущем домене.`,
    }
  }

  return { valid: true }
}
