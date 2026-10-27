import type { RQueryEditor } from '@/features/endge-ide/domain/entities/RQueryEditor'
import type { QueryRunnerDependencies } from '@/features/endge-ide/services/query-run/query-runner'

import { Endge } from '@endge/core'

/**
 * Связывает запуск панели с runtime core: текст редактора применяется к Query домена,
 * artifact пересобирается, выполнение идёт через `Endge.runtime.query.run`.
 */
export function createEndgeQueryRunDependencies(editor: RQueryEditor): QueryRunnerDependencies {
  return {
    prepare: () => {
      const idOrIdentity = editor.id ?? editor.identity
      const query = Endge.domain.getQuery(idOrIdentity)
      if (!query) {
        throw new Error(`Query not found in domain: "${idOrIdentity}".`)
      }
      editor.updateSource(query)
      Endge.compiler.buildQuery(query)
      const artifact = Endge.program.getQueryArtifact(query.id ?? query.identity)
      if (!artifact) {
        throw new Error(`Query artifact is missing for "${idOrIdentity}".`)
      }
      if (artifact.status === 'error') {
        throw new Error(artifact.diagnostics[0]?.message ?? `Query artifact has compile errors for "${idOrIdentity}".`)
      }
      return query
    },
    execute: (query, props, observer) => Endge.runtime.query.run(query, props, null, { observer }),
  }
}

/**
 * Разрешает переменную окружения Workspace для предпросмотра GraphQL variables
 * так же, как исполнитель Query: неразрешённый токен остаётся как есть.
 */
export function resolveWorkspaceEnvironment(name: string): unknown {
  const token = `{${name}}`
  return Endge.workspace.variables.resolve(token) || token
}
