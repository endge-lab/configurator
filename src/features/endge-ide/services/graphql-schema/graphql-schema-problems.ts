import type { GraphQLSchemaInput, ProgramDiagnostic } from '@endge/core'
import type { GraphQLSchemaSourceKind, GraphQLSchemaTarget } from '@/features/endge-ide/services/graphql-schema/graphql-schema-target'

import { GRAPHQL_SCHEMA_DIAGNOSTIC_SOURCE, validateGraphQLSourceTemplates } from '@/features/endge-ide/services/graphql-schema/graphql-schema-diagnostics'
import { resolveGraphQLSchemaTarget } from '@/features/endge-ide/services/graphql-schema/graphql-schema-target'

// sourcePath схемных диагностик в панели «Диагностика»: отличает их от диагностик компилятора.
export const GRAPHQL_SCHEMA_PROBLEM_SOURCE_PATH = 'graphql-schema'

interface SchemaLookup {
  entryFor: (target: GraphQLSchemaTarget | null) => { schema: GraphQLSchemaInput } | null
}

interface SourceCompiler {
  compile: (sourceKind: string, source: string) => { document?: unknown }
}

/**
 * Проверка gql`...` Source по сохранённой схеме в виде authoring-диагностик панели
 * «Диагностика»: те же правила и позиции, что маркеры редактора. Без схемы — пусто.
 */
export function collectGraphQLSchemaProblems(
  schemas: SchemaLookup,
  compiler: SourceCompiler,
  sourceKind: GraphQLSchemaSourceKind,
  source: string,
): ProgramDiagnostic[] {
  const entry = schemas.entryFor(resolveGraphQLSchemaTarget(compiler, sourceKind, source))
  if (!entry) {
    return []
  }
  return validateGraphQLSourceTemplates(entry.schema, source).map(diagnostic => ({
    severity: diagnostic.severity,
    code: diagnostic.code,
    message: `${GRAPHQL_SCHEMA_DIAGNOSTIC_SOURCE}: ${diagnostic.message}`,
    sourcePath: GRAPHQL_SCHEMA_PROBLEM_SOURCE_PATH,
    start: diagnostic.start,
    end: diagnostic.end,
  }))
}
