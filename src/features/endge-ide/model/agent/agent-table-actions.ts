/**
 * Реестр действий агента над текущей таблицей (колонки, dataPaths).
 * Редактор таблицы и инспектор регистрируют обработчики при монтировании.
 */

export type AgentTableActionName =
  | "auto_fill_datapaths"
  | "clear_all_datapaths"
  | "add_column"
  | "remove_column";

export type AgentTableActionParams = {
  auto_fill_datapaths?: void;
  clear_all_datapaths?: void;
  add_column?: { title: string };
  remove_column?: { index: number };
};

const _handlers: Partial<
  Record<
    AgentTableActionName,
    (params?: unknown) => boolean | void | Promise<boolean | void>
  >
> = {};

/** Регистрирует обработчик действия. Возвращает функцию отмены регистрации. */
export function registerAgentTableAction(
  name: AgentTableActionName,
  fn: (params?: unknown) => boolean | void | Promise<boolean | void>,
): () => void {
  _handlers[name] = fn;
  return () => {
    delete _handlers[name];
  };
}

/** Выполняет действие над текущей таблицей (если зарегистрирован обработчик). */
export async function runAgentTableAction(
  name: AgentTableActionName,
  params?: unknown,
): Promise<boolean> {
  const fn = _handlers[name];
  if (!fn) return false;
  const result = await Promise.resolve(fn(params));
  return result !== false;
}
