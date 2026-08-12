import type { ConfiguratorWorkspaceAccess } from '@/features/configurator-session/domain/types/configurator-session.type'

/** Выбирает только активный Workspace: сначала сохранённый, затем необязательный env seed. */
export function resolveConfiguratorWorkspace(
  workspaces: readonly ConfiguratorWorkspaceAccess[],
  storedIdentity: string | null,
  seedIdentity: string,
): ConfiguratorWorkspaceAccess | null {
  const available = workspaces.filter(workspace => workspace.active)
  return available.find(workspace => workspace.identity === storedIdentity)
    ?? available.find(workspace => workspace.identity === seedIdentity)
    ?? null
}
