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

  if (target.entityType === 'project') {
    return validateCoordinate('проект', target.identity, Endge.context.getCurrentProject())
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

  if (!composition.kindIdentity) {
    return { valid: true }
  }

  switch (composition.kind) {
    case 'environment':
      return validateCoordinate('среду', composition.kindIdentity, Endge.context.getCurrentEnvironment())
    case 'tenant':
      return validateCoordinate('тенант', composition.kindIdentity, Endge.context.getCurrentTenant())
    default:
      return { valid: true }
  }
}

function validateCoordinate(label: string, requested: string, current: string): RuntimePreviewContextValidation {
  if (requested === current) {
    return { valid: true }
  }
  return {
    valid: false,
    message: `Невозможно запустить ${label}`,
    description: `Документ относится к «${requested}», а текущий контекст установлен на «${current}». Сначала смените контекст в нижней панели.`,
  }
}
