import type { WorkflowDependency } from '@/features/project-workflow/domain/ProjectWorkflow'
import { ProjectWorkflow } from '@/features/project-workflow/domain/ProjectWorkflow'

/** Отдельная сцена Workspace с прежним механизмом раскладки и границами проектных графов. */
export class WorkspaceWorkflow extends ProjectWorkflow {
  public override replaceRoots(roots: WorkflowDependency[]): void {
    // Каждый Project является самостоятельным composition graph: его Store providers
    // не должны разрешаться в графе соседнего проекта или теряться у корня Workspace.
    const adapt = (node: WorkflowDependency): WorkflowDependency => ({
      ...node,
      kind: node.documentType === 'project' ? 'composition' : node.kind,
      children: node.children.map(adapt),
    })
    super.replaceRoots(roots.map(adapt))
  }

  public override get scene() {
    const scene = super.scene
    return {
      ...scene,
      nodes: scene.nodes.map(node => node.data.documentType === 'project'
        ? { ...node, data: { ...node.data, kind: 'project' } }
        : node),
    }
  }
}
