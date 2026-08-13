export function canManageAccess(platformAdmin: boolean, workspaceRole: string): boolean {
  return platformAdmin || workspaceRole === 'admin'
}
