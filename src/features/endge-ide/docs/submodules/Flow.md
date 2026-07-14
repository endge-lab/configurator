# Endge.runtime.flow

Единый модуль исполнения action-flow.

- `run(host)` исполняет flow целиком внутри конкретного `RuntimeHost<'action'>`.
- `runBlock(host, blockId)` исполняет один блок в контексте конкретного `RuntimeHost<'action'>`.
- Парсинг/нормализация модели выполняются на этапе `RAction.compile()`, а в runtime используются уже подготовленные структуры.
