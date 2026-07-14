import type { ExtractComponentDialogDependency } from './extract-component.types'

export interface ExtractComponentPropsJsonResult {
  dependencies: ExtractComponentDialogDependency[] | null
  error: string | null
}

export function serializeExtractComponentPropsJson(
  dependencies: readonly ExtractComponentDialogDependency[],
): string {
  return JSON.stringify(
    Object.fromEntries(dependencies.map(dependency => [dependency.propName, dependency.type])),
    null,
    2,
  )
}

export function parseExtractComponentPropsJson(
  source: string,
  detectedDependencies: readonly ExtractComponentDialogDependency[],
): ExtractComponentPropsJsonResult {
  let value: unknown
  try {
    value = JSON.parse(source)
  }
  catch {
    return { dependencies: null, error: 'Исправьте синтаксис JSON.' }
  }

  if (!isRecord(value)) {
    return { dependencies: null, error: 'Props должны быть JSON-объектом.' }
  }

  const expectedNames = new Set(detectedDependencies.map(dependency => dependency.propName))
  const missing = detectedDependencies.filter(dependency => !(dependency.propName in value))
  if (missing.length) {
    return { dependencies: null, error: `Нельзя удалить используемые props: ${missing.map(item => item.propName).join(', ')}.` }
  }

  const unknownNames = Object.keys(value).filter(name => !expectedNames.has(name))
  if (unknownNames.length) {
    return { dependencies: null, error: `Неизвестные props без source expression: ${unknownNames.join(', ')}.` }
  }

  for (const [name, type] of Object.entries(value)) {
    if (typeof type !== 'string' || !type.trim()) {
      return { dependencies: null, error: `Тип prop "${name}" должен быть непустой строкой.` }
    }
  }

  return {
    dependencies: detectedDependencies.map(dependency => ({
      ...dependency,
      type: String(value[dependency.propName]).trim(),
      paths: [...dependency.paths],
    })),
    error: null,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
