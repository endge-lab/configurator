# Endge.bind

`Endge.bind` - это модуль программной подмены реализации у уже существующих сущностей ядра.

Он нужен, когда разработчик хочет вручную подключить собственный код к:

- `converter`;
- `action`;
- `runtime step`.

---

## Что делает модуль

`Endge.bind` не работает с event contracts и не исполняет declarative bindings.

Он только:

1. находит нужную сущность по `identity` и в контексте конкретного `action`;
2. передаёт ей кастомный handler;
3. подменяет стандартную реализацию на программную.

---

## Примеры использования

- `Endge.bind.converter('to-array', handler)`
- `Endge.bind.action(action, 'console-log', handler)`

Это именно developer API, а не пользовательская конфигурация.

---

## Чем отличается от `Endge.bindings`

Важно различать:

- `Endge.bind` - подмена кода;
- `Endge.bindings` - выполнение сохранённых в домене реакций на события.

Если реакция должна жить в конфигураторе, наследоваться и зависеть от environment, это уже не `Endge.bind`, а `Endge.bindings`.
