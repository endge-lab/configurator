# Endge.runtime

`Endge.runtime` - это слой живых runtime-инстансов, который связывает доменные сущности с реактивным графом `Raph`.

Сейчас он уже умеет создавать runtime для:

- `query`
- `table`
- `action`

Именно runtime-инстанс, а не сама reflect-сущность, является исполняемым объектом:

- он живёт на `RaphNode`;
- он имеет собственный lifecycle;
- он получает события из фаз `Raph`;
- он может иметь собственный event bus.

---

## Что такое runtime-сущность

Runtime-сущность - это не просто запись в домене и не просто конфигурация.

Это живой объект, у которого есть:

- `runtimeId`
- `entityType`
- `entityId`
- `RaphNode`
- собственная жизнь `create -> work -> destroy`
- связь с runtime-событиями

В текущем коде роль таких сущностей выполняют typed runtime hosts для query, action, filter, composition, store и ComponentSFC.

---

## Что не является runtime-сущностью

Важно не путать runtime-сущность с другими слоями:

- `EventContract` - каталог допустимых событий;
- `Binding` - сохраняемая конфигурация реакции;
- `Project / Page` - доменные сущности, которые пока ещё не доведены до общего runtime-host слоя;
- `RuntimeBindingScope` - это описание binding-контекста, а не root runtime-сущность.

---

## Как `Endge.runtime` связан с `Raph`

`Endge.runtime` не хранит данные отдельно от `Raph`, а живёт поверх него.

Принцип такой:

1. создаётся `RaphNode`;
2. node получает `meta` с типом runtime и привязкой к entity;
3. node начинает track-ить нужные пути в `Raph`;
4. фазы `Raph` уведомляют runtime;
5. runtime исполняет свою логику и при необходимости эмитит события.

For SFC components this includes reactive input bindings and collection projections.
для запросов - реакция на смену filter-space,  
для action - lifecycle шагов flow.

---

## Что должно быть дальше

Целевая архитектура требует, чтобы такой же runtime-host получили и другие важные сущности:

- `Project`
- `Page`

Тогда весь runtime становится единообразным:

- у всех есть host;
- все живут в `Raph`;
- все испускают канонические события;
- bindings и actions работают поверх единого dispatcher.
