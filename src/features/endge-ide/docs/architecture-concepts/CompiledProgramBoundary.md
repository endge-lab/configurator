# Compiled Program Boundary

`Endge.program` - это in-memory read-model между persisted-доменом и runtime.

## Граница модулей

- `Endge.domain` хранит persisted definitions: документы, source, связи и конфигурацию.
- `Endge.compiler` запускает фазовую компиляцию домена и строит artifacts.
- `Endge.program` хранит compiled artifacts, diagnostics, capabilities и индексы.
- `Endge.runtime` создает live runtime-hosts и управляет lifecycle.
- `Endge.uiRegistry` предоставляет runtime доступ к зарегистрированным SFC-компонентам.

## Правило совместимости

Legacy Table/DSL fields remain persisted and editable, but they are data-only. Compiler, runtime hosts, and renderers do not consume them. Executable UI uses `ComponentSFC` artifacts.
