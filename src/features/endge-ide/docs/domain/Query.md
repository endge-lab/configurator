# Query source

`Query` описывает загрузку данных из внешнего источника и граф результатов, которые должны появиться после выполнения запроса.

Главное правило: `request` отвечает только за обращение к backend, а `outputs` отвечает за то, какие данные считаются результатами запроса, как они преобразуются и куда сохраняются.

## Базовый пример

```ts
defineQuery({
  kind: 'rest',

  request: {
    endpoint: '{ENDPOINT_AODB}',
    path: '/flights',
    method: 'GET',
    headers: {},
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

  params: {},
  filters: { mode: 'merge', items: [] },
  mock: { enabled: false, data: null },
})
```

## Секции

### `kind`

Тип запроса. В первой версии поддерживается `rest`.

```ts
kind: 'rest'
```

### `request`

Описание HTTP-запроса.

```ts
request: {
  endpoint: '{ENDPOINT_AODB}',
  path: '/flights',
  method: 'GET',
  headers: {},
  auth: { mode: 'inherit' },
}
```

`endpoint` может быть строкой или ссылкой на переменную в формате `{NAME}`. `path` задает путь внутри endpoint. `method` по умолчанию может быть `GET`, `POST` или другим HTTP-методом, если runtime его поддерживает.

Авторизация запроса задается через `request.auth`. Для конкретного профиля используется его `identity`:

```ts
auth: {
  mode: 'profile',
  profile: 'keycloak-dev',
}
```

### `outputs`

`outputs` описывает именованные результаты запроса. Каждый ключ внутри `outputs` является локальным именем output-узла.

```ts
outputs: {
  raw: output().from(response('items')).toStore(),
  rows: output().from('raw').dataView(dataView('flightRows')).toStore(),
}
```

Output-узлы образуют граф. Узел может ссылаться только на output, который объявлен выше.

Правильно:

```ts
outputs: {
  raw: output().from(response('items')).toStore(),
  rows: output().from('raw').dataView(dataView('flightRows')).toStore(),
}
```

Неправильно:

```ts
outputs: {
  rows: output().from('raw').dataView(dataView('flightRows')).toStore(),
  raw: output().from(response('items')).toStore(),
}
```

## Output DSL

### `output()`

Начинает описание одного output-узла.

```ts
raw: output()
```

`output()` не загружает данные и не сохраняет их сам по себе. Он создает декларативную цепочку, в которой явно задаются источник, преобразования и сохранение результата.

### `.from(source)`

Задает источник output.

Источник может быть backend response:

```ts
raw: output()
  .from(response('items'))
  .toStore()
```

Источник может быть другим output, объявленным выше:

```ts
rows: output()
  .from('raw')
  .dataView(dataView('flightRows'))
  .toStore()
```

### `response(path?)`

Ссылка на результат backend-запроса.

```ts
response()
```

означает весь response.

```ts
response('items')
```

означает поле `items` внутри response.

`response(...)` не задает store key. Это только selector входных данных.

### `.dataView(transform)`

Применяет DataView к текущему output input.

Ссылка на существующий доменный DataView:

```ts
rows: output()
  .from('raw')
  .dataView(dataView('flightRows'))
  .toStore()
```

Локальный DataView, принадлежащий только этому query:

```ts
rows: output()
  .from('raw')
  .dataView(defineDataView({
    mode: 'pipeline',
    steps: [
      from('').as('row'),
      map({
        flightNumber: path('row.flight'),
      }),
    ],
  }))
  .toStore()
```

Локальный DataView не создается как отдельная domain entity. При компиляции query он становится child artifact внутри compiled query artifact.

### `.toStore(target?)`

Сохраняет output в runtime store.

Без аргументов используется ключ по умолчанию:

```ts
raw: output()
  .from(response('items'))
  .toStore()
```

Дефолтный ключ для любого output:

```text
queries.<query_identity>.<output_key>
```

Например:

```ts
outputs: {
  raw: output().from(response('items')).toStore(),
  rows: output().from('raw').dataView(dataView('flightRows')).toStore(),
}
```

для query `flights` даст:

```text
raw  -> queries.flights.raw
rows -> queries.flights.rows
```

Ключ можно переопределить строкой:

```ts
rows: output()
  .from('raw')
  .dataView(dataView('flightRows'))
  .toStore('aodb.flights.rows')
```

Расширенная форма зарезервирована для будущих настроек:

```ts
.toStore({
  key: 'aodb.flights.rows',
})
```

`mode`, `ttl`, `append`, `merge` и автоматическое обновление кэша не входят в первую версию. В первой версии сохранение работает как `replace`: новое значение полностью заменяет старое значение по ключу.

## Локальные и глобальные DataView

Глобальный DataView:

```ts
rows: output()
  .from('raw')
  .dataView(dataView('flightRows'))
  .toStore()
```

Локальный DataView:

```ts
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
  .toStore()
```

Правило:

```text
dataView('identity')     - ссылка на существующий доменный DataView.
defineDataView({...})    - локальный DataView внутри query.
converter('identity')    - ссылка на существующий converter.
defineConverter({...})   - будущий локальный converter; в первой версии не разрешен.
```

## Цепочки outputs

DataView может строиться на результате другого DataView:

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
            id: path('row.id'),
            flightNumber: path('row.flight'),
          }),
        ],
      }))
      .toStore(),

    displayRows: output()
      .from('rows')
      .dataView(dataView('formatFlightRows'))
      .toStore(),
  },
})
```

Compiler должен построить graph `raw -> rows -> displayRows`, проверить порядок, неизвестные ссылки и циклы.

## Компиляция

`query-source-compile` парсит `defineQuery(...)` и строит normalized query source document. Он не должен напрямую обращаться к `Endge.compiler` или `Endge.program`.

`Endge.compiler` компилирует query artifact. Если query source содержит `defineDataView(...)`, compiler делегирует эту часть существующему DataView compiler-у и добавляет результат как child artifact.

Итоговая модель:

```ts
ProgramArtifact<QueryProgramPayload> {
  payload: {
    request: { ... },
    outputs: [
      {
        key: 'raw',
        source: { type: 'response', path: 'items' },
        store: { mode: 'default' },
      },
      {
        key: 'rows',
        source: { type: 'output', key: 'raw' },
        dataViews: [
          { kind: 'local', ref: { entityType: 'data-view', identity: 'flights::outputs.rows.dataView.0' } },
        ],
        store: { mode: 'default' },
      },
    ],
  },
  children: [
    ProgramArtifact<DataViewProgramPayload>
  ],
}
```

`Endge.query` отвечает за порядок выполнения outputs и сохранение в store. `Endge.dataView` отвечает за выполнение DataView artifact.

## Безопасность

В локальных query-owned DataView первой версии разрешен только декларативный `pipeline`.

Запрещено внутри query v1:

```ts
defineDataView({
  mode: 'manual',
  transform(input, tools) {
    return input
  },
})
```

Причина: manual transform исполняет пользовательский JS-код. До появления sandbox-механизма локальный произвольный код нельзя выполнять безопасно.

Разрешенный вариант:

```ts
defineDataView({
  mode: 'pipeline',
  steps: [
    from('').as('row'),
    map({
      id: path('row.id'),
    }),
  ],
})
```

Pipeline безопаснее, потому что source парсится в ограниченный AST, compiler принимает только известные операции, а runtime интерпретирует compiled steps без выполнения произвольного JS.
