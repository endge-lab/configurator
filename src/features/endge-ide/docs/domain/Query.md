# Query

Query — source-first описание получения данных. Query формирует именованные `outputs`, но не выбирает, где они будут храниться и кто будет их использовать.

## Базовый пример

```ts
defineQuery({
  kind: 'rest',

  props: defineProps({
    filterPayload: field('Object')
      .optional()
      .from(filter('schedule').output('request')),
  }),

  request: {
    endpoint: env('ENDPOINT_AODB'),
    path: '/select',
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    auth: {
      mode: 'profile',
      profile: 'keycloak-dev',
    },
    body: body(({ prop }) =>
      merge({}, prop('filterPayload')),
    ),
  },

  outputs: {
    raw: output()
      .from(response()),
  },

  mock: {
    enabled: false,
    data: null,
  },
})
```

## Ответственность

Query отвечает за:

- входные `props`;
- transport и auth;
- request body;
- mock response;
- ordered output graph;
- локальные и внешние DataView внутри outputs.

Query не записывает данные в Store или произвольный Raph path. Связывание outputs с другими сущностями выполняет Composition.

## Props

```ts
props: defineProps({
  filterPayload: field('Object').optional(),
  limit: field('Number').default(100),
})
```

Prop участвует в HTTP-запросе только при явной ссылке из `request.body`:

```ts
body: body(({ prop }) =>
  merge(
    { limit: prop('limit') },
    prop('filterPayload'),
  ),
),
```

## Outputs

Каждый output получает данные из response или предыдущего output:

```ts
outputs: {
  raw: output()
    .from(response('items')),

  rows: output()
    .from('raw'),
}
```

Ссылаться можно только на output, объявленный выше.

## DataView в Query

Внешний DataView:

```ts
outputs: {
  raw: output()
    .from(response('items')),

  rows: output()
    .from('raw')
    .dataView(dataView('flightRows')),
}
```

Локальный DataView:

```ts
outputs: {
  raw: output()
    .from(response('items')),

  rows: output()
    .from('raw')
    .dataView(defineDataView({
      mode: 'pipeline',
      steps: [
        from('').as('row'),
        map({
          ...spread('row'),
          departureTime: path('row.departureTime')
            .convert('time-string-to-date'),
        }),
      ],
    })),
}
```

Локальный DataView компилируется как child artifact Query и не создаёт отдельный доменный документ.

## Preview и runtime

Preview компилирует Query, создаёт временный `QueryRuntimeHost`, выполняет запрос и выводит каждый output в консоль. После standalone-запуска временный host уничтожается.

В Composition `QueryRuntimeHost` может жить дольше одного вызова. Он обеспечивает повторные запуски, reactive props, отмену устаревшего HTTP-запроса, default Filter runtime и события изменения outputs.

## Связывание в Composition

Query только публикует output:

```ts
raw: output().from(response())
```

Composition решает, куда его передать:

```ts
query: query('schedule')
  .withProps({
    filterPayload: fromOutput('filter', 'request'),
  })
```

Запись output в Store будет частью binding-контракта Composition, а не Query source.
