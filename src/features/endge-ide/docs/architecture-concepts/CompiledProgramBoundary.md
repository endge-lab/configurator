# Compiled Program Boundary

`Endge.program` - это in-memory read-model между persisted-доменом и runtime.

## Граница модулей

- `Endge.domain` хранит persisted definitions: документы, source, связи и конфигурацию.
- `Endge.compiler` запускает фазовую компиляцию домена и строит artifacts.
- `Endge.program` хранит compiled artifacts, diagnostics, capabilities и индексы.
- `Endge.runtime` создает live runtime-hosts и управляет lifecycle.
- `Endge.render` и presentation bindings подключают визуализацию только там, где она нужна.

## Правило совместимости

На первом этапе legacy-поля моделей остаются рабочими. Compiler может делегировать старым `entity.compile()`, затем сохранять результат в `Endge.program`. Runtime и renderers могут продолжать читать старые поля до отдельной миграции consumers.
