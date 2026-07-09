# DataView source

`DataView` описывает преобразование входных данных в выходную форму. Один и тот же DataView-механизм используется для глобальных доменных DataView и для локальных DataView, вложенных в query artifact.

## Главные правила

- `defineDataView({...})` описывает DataView source.
- `pipeline` DataView декларативен и выполняется runtime-интерпретатором.
- `manual` DataView содержит произвольный JS-код и не разрешен для локальных query-owned DataView первой версии.
- Глобальные DataView и локальные child DataView должны компилироваться в один и тот же `DataViewProgramPayload`.

## Pipeline DataView

```ts
defineDataView({
  mode: 'pipeline',

  steps: [
    from('raw').as('row'),

    map({
      ...spread('row'),
      flightNumber: path('row.flight'),
    }),
  ],
})
```

`steps` выполняются последовательно. В первой версии поддерживаются `from`, `join` и `map`.

## `from(source).as(alias)`

Берет массив из входного scope и задает имя текущей строки.

```ts
from('raw').as('row')
```

Если вход:

```ts
{
  raw: [
    { id: 1, flight: 'SU100' },
  ],
}
```

то `row` внутри `map` будет одной строкой из `raw`.

## `map({...})`

Формирует выходной объект для каждой строки.

```ts
map({
  id: path('row.id'),
  flightNumber: path('row.flight'),
})
```

Каждое поле может быть literal value, `path(...)`, `template(...)` или результатом chain-операций над `path`.

## `spread(alias)`

Копирует поля объекта в output.

```ts
map({
  ...spread('row'),
  flightNumber: path('row.flight'),
})
```

Если поле задано после spread, оно переопределяет скопированное значение.

## `path(path)`

Читает значение из текущего scope.

```ts
path('row.flight')
```

Path может ссылаться на alias текущей строки, join-result или input.

```ts
path('input.meta.requestId')
path('row.flight')
path('attrs.items')
```

## `join(source).by(...)`

Присоединяет данные из другого массива входного scope.

```ts
defineDataView({
  mode: 'pipeline',

  steps: [
    from('legs').as('leg'),

    join('attrs').by({
      left: 'leg.id',
      right: 'legId',
      as: 'legAttrs',
    }),

    map({
      ...spread('leg'),
      attrs: path('legAttrs.items'),
    }),
  ],
})
```

`left` читается из текущего scope. `right` читается из каждого элемента массива `source`. Первый найденный элемент сохраняется под именем `as`.

## Chain-операции над `path`

### `.pick(path)`

Берет вложенное поле из значения.

```ts
map({
  code: path('row.airport').pick('code'),
})
```

### `.find(criteria)`

Ищет элемент внутри массива.

```ts
map({
  currentStatus: path('row.statuses').find({ active: true }),
})
```

### `.convert(converter, options?)`

Применяет converter.

Ссылка на глобальный converter:

```ts
map({
  stdTime: path('row.std').convert(converter('date.iso_to_time'), { format: 'HH:mm' }),
})
```

В первой версии локальные converters через `defineConverter({...})` зарезервированы, но не разрешены для исполнения без sandbox.

## `template(template)`

Формирует строку из scope.

```ts
map({
  title: template('{row.flight} / {row.destination}'),
})
```

## Локальный DataView внутри Query

```ts
defineQuery({
  kind: 'rest',

  request: {
    endpoint: '{ENDPOINT_AODB}',
    path: '/flights',
    method: 'GET',
    auth: { mode: 'inherit' },
  },

  outputs: {
    raw: output()
      .from(response('items'))
      .toStore(),

    rows: output()
      .from('raw')
      .dataView(defineDataView({
        mode: 'pipeline',
        steps: [
          from('').as('row'),
          map({
            ...spread('row'),
            flightNumber: path('row.flight'),
          }),
        ],
      }))
      .toStore(),
  },
})
```

Локальный DataView не сохраняется как отдельная domain entity. Он компилируется в child artifact внутри query artifact.

## Глобальный DataView

```ts
defineQuery({
  kind: 'rest',

  request: {
    endpoint: '{ENDPOINT_AODB}',
    path: '/flights',
    method: 'GET',
    auth: { mode: 'inherit' },
  },

  outputs: {
    raw: output()
      .from(response('items'))
      .toStore(),

    rows: output()
      .from('raw')
      .dataView(dataView('flightRows'))
      .toStore(),
  },
})
```

`dataView('flightRows')` ссылается на существующий доменный DataView по identity.

## DataView внутри DataView

`from(...).dataView(...).as(...)` применяет другой DataView к выбранному source до того, как pipeline начнет проходить по строкам.

```ts
defineDataView({
  mode: 'pipeline',

  steps: [
    from('items')
      .dataView(dataView('normalizeFlight'))
      .as('row'),

    map({
      id: path('row.id'),
      label: template('{row.flightNumber}'),
    }),
  ],
})
```

Локальный вариант:

```ts
defineDataView({
  mode: 'pipeline',

  steps: [
    from('items')
      .dataView(defineDataView({
        mode: 'pipeline',
        steps: [
          from('').as('row'),
          map({
            id: path('row.id'),
            flightNumber: path('row.flight'),
          }),
        ],
      }))
      .as('row'),

    map({
      id: path('row.id'),
      label: template('{row.flightNumber}'),
    }),
  ],
})
```

Локальный DataView внутри другого DataView также должен быть `pipeline`. `manual` разрешен только для trusted/global DataView.

## Manual DataView

Manual DataView поддерживается только как trusted/global сценарий и не должен использоваться как локальный DataView внутри query или другого DataView первой версии.

```ts
defineDataView({
  mode: 'manual',

  transform(input, tools) {
    return input.raw
  },
})
```

Причина: manual transform выполняет пользовательский код. Для локальных сущностей, которые пользователь может писать прямо в query source, безопасной базой является только pipeline.

## Компиляция и исполнение

`DataView source compiler` превращает `defineDataView(...)` в:

```ts
DataViewProgramPayload {
  type: 'data-view',
  mode: 'pipeline',
  sourceDocument: { ... },
  transform: null,
  steps: [ ... ],
}
```

`Endge.compiler` оборачивает payload в `ProgramArtifact<DataViewProgramPayload>`.

`Endge.dataView` исполняет compiled payload. Для query-owned локальных DataView query runtime должен передавать child artifact в тот же executor, который используется для глобальных DataView.
