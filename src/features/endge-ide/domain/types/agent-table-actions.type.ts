export type AgentTableActionName
  = | 'auto_fill_datapaths'
    | 'clear_all_datapaths'
    | 'add_column'
    | 'remove_column'

export type AgentTableActionHandler = (
  params?: unknown,
) => boolean | void | Promise<boolean | void>
