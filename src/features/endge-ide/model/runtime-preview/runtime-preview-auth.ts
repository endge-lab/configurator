import type { AuthProfileSchema, ProgramArtifact, QueryProgramPayload } from '@endge/core'
import type { RuntimePreviewLaunchRequest } from '@/features/endge-ide/domain/types/runtime-preview.types'

import { Endge } from '@endge/core'

/** Собирает только auth profiles Query, достижимых из запускаемого preview graph. */
export function collectRuntimePreviewAuthProfiles(request: RuntimePreviewLaunchRequest): AuthProfileSchema[] {
  if (Endge.context.isMockEnabled)
    return []
  const starts = request.entityType === 'project'
    ? Endge.domain.getCompositions()
        .filter(item => item.kind === 'project' && item.kindIdentity === request.identity && item.active !== false && !item.deletedAt)
        .map(item => ({ entityType: 'composition', identity: item.identity }))
    : [{ entityType: request.entityType, identity: request.identity }]
  const queue = [...starts]
  const visited = new Set<string>()
  const identities = new Set<string>()
  while (queue.length) {
    const current = queue.shift()!
    if (current.entityType === 'project')
      continue
    const key = `${current.entityType}:${current.identity}`
    if (visited.has(key))
      continue
    visited.add(key)
    const artifact = Endge.program.getArtifact(current.entityType as any, current.identity) as ProgramArtifact | null
    if (!artifact || artifact.status === 'error')
      continue
    if (current.entityType === 'query')
      collectQueryProfile(artifact as ProgramArtifact<QueryProgramPayload>, identities)
    for (const dependency of artifact.dependencies) {
      if (['query', 'composition', 'component-sfc', 'store', 'data-view', 'filter', 'computation'].includes(dependency.entityType))
        queue.push({ entityType: dependency.entityType, identity: dependency.identity ?? String(dependency.id) })
    }
  }
  return [...identities].map(identity => Endge.auth.profiles.requireActive(identity))
}

function collectQueryProfile(artifact: ProgramArtifact<QueryProgramPayload>, identities: Set<string>): void {
  const auth = artifact.payload.auth
  if (!auth || typeof auth !== 'object' || Array.isArray(auth) || 'type' in auth) {
    const profile = Endge.auth.profiles.getDefault()
    if (profile)
      identities.add(profile.identity)
    return
  }
  const policy = auth as Record<string, unknown>
  if (policy.mode === 'none')
    return
  if (policy.mode === 'profile') {
    const identity = String(policy.profileIdentity ?? '').trim()
    if (identity)
      identities.add(identity)
    return
  }
  const profile = Endge.auth.profiles.getDefault()
  if (profile)
    identities.add(profile.identity)
}
