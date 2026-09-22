import type { AgentTableActionHandler, AgentTableActionName } from '@/features/endge-ide/domain/types/agent-table-actions.type'

/** Владеет actions агента, зарегистрированными текущим смонтированным редактором таблицы. */
export class AgentTableActions_Module {
  private readonly _handlers: Partial<Record<AgentTableActionName, AgentTableActionHandler>> = {}

  public register(name: AgentTableActionName, handler: AgentTableActionHandler): () => void {
    this._handlers[name] = handler
    return () => {
      if (this._handlers[name] === handler) {
        delete this._handlers[name]
      }
    }
  }

  public async run(name: AgentTableActionName, params?: unknown): Promise<boolean> {
    const handler = this._handlers[name]
    if (!handler) {
      return false
    }
    return await handler(params) !== false
  }

  public reset(): void {
    for (const name of Object.keys(this._handlers) as AgentTableActionName[]) {
      delete this._handlers[name]
    }
  }
}
