# Endge.events

Шина событий для связи между частями приложения: runtime-подписчики, SSE, обновления данных и произвольные события из кода. Доступен только в коде через `import { Endge } from '@endge/core'`; в глобальную консоль браузера не выставляется.

---

## Что это такое в архитектуре

`Endge.events` - это transport-слой, а не реестр контрактов и не хранилище bindings.

Он нужен, когда код хочет:

- подписаться на событие;
- пробросить событие дальше;
- отреагировать на системный runtime-факт без участия UI-конфигуратора.

Поэтому важно различать:

- `EventContract` - описание допустимого события;
- `Binding` - конфигурируемое правило реакции;
- `Endge.events` - шина доставки runtime-сообщений в код.

---

## Назначение

- Подписка на системные события (сообщения SSE, применение обновлений и т.д.).
- Эмит типизированных событий ядра и произвольных событий.
- Опциональный кеш последних событий для отладки.
- Поддержка кодовых реакций, которые не хочется хранить в доменной конфигурации.

---

## Порядок в общем flow

Если runtime host сообщает о каноническом событии, архитектурно поток читается так:

1. возникает runtime-факт;
2. ядро нормализует его как каноническое событие;
3. `Endge.bindings` резолвит и исполняет bindings;
4. затем это же событие может быть проброшено в `Endge.events` для кодовых подписчиков.

То есть шина не заменяет bindings и не обязана быть их источником. Она следует рядом как transport-слой наблюдения и кодовых реакций.

---

## Как `Endge.events` соотносится с `Raph`

`Endge.events` не является заменой `Raph`.

Это два разных слоя:

- `Raph` доставляет изменения данных до runtime-нод;
- `Endge.events` доставляет смысловые runtime-сообщения до подписчиков из кода.

Если data-change дошёл до runtime-host через `Raph`, host уже может:

- обновить своё состояние;
- испустить канонический event;
- передать его в `Endge.bindings`;
- опубликовать его в `Endge.events`.

---

## Один факт и несколько реакций

Если смонтировалась страница, сам runtime-факт один. Но он может одновременно:

- сработать как `owner`-событие страницы;
- сработать как `target`-событие проекта;
- попасть в `Endge.events` как единый канонический факт для подписчиков из кода.

Это не три разных мира событий, а один факт, который проходит через несколько архитектурных слоёв.

---

## API

**Типизированные события ядра** (имена и payload заданы в конфиге ядра):

- **`Endge.events.onEvent(events, callback)`** - подписка. `events` - одно имя или массив имён, `callback(e: EndgeEvent<T>)`. Возвращает функцию отписки `() => void`.
- **`Endge.events.emitEvent(event, payload, opts?)`** - эмит. Возвращает объект `EndgeEvent`.

**Динамические (кастомные) события** (произвольные имена, payload типизируется при использовании):

- **`Endge.events.onDynamic(events, callback)`** - подписка на кастомное имя. Возвращает функцию отписки.
- **`Endge.events.emitDynamic(event, payload, opts?)`** - эмит кастомного события.

**Низкоуровневые методы** (без обёртки в `EndgeEvent`, для совместимости):

- **`on(events, callback)`** / **`off(events, callback)`** - подписка/отписка по типизированным событиям.
- **`onCustom(events, callback)`** / **`offCustom(events, callback)`** - то же для кастомных имён.

**Объект события `EndgeEvent<T>`:**

- **`payload`** - данные события (readonly).
- **`cancel()`** - помечает событие отменённым (`isCanceled = true`). Может использоваться совместно с опцией `stopOnCancel` при эмите.
- **`isCanceled`** - флаг отмены.

---

## События ядра

| Событие             | Payload | Описание |
|---------------------|--------|----------|
| `sse:message`       | `{ message: unknown }` | Сообщение, полученное по SSE. |
| `updates:message`   | `{ type: string; message: unknown }` | Сообщение о доступных обновлениях. |
| `updates:applied`   | `{ identity: string; count: number }` | Обновления применены (identity и количество). |

---

## Примеры: подписка и эмит

### Системные события ядра

Подписка: `onEvent(имя, callback)`. В callback приходит `EndgeEvent<T>` с полем `payload`. Метод возвращает функцию отписки.

```ts
import { Endge } from '@endge/core'

// Подписка на сообщения SSE (эмитит ядро при получении данных)
const unwatchSse = Endge.events.onEvent('sse:message', (e) => {
  console.log('SSE:', e.payload.message)
})

// Подписка на применение обновлений
Endge.events.onEvent('updates:applied', (e) => {
  console.log('Применено:', e.payload.identity, e.payload.count)
})

// Отписаться от SSE
unwatchSse()
```

Эмит системных событий обычно выполняет само ядро (SSE, updates). При необходимости можно вызвать из кода:

```ts
Endge.events.emitEvent('sse:message', { message: { type: 'Custom', data: 1 } })
Endge.events.emitEvent('updates:applied', { identity: 'profile', count: 5 })
```

### Произвольные (кастомные) события

Имя события - любая строка (например, `my:feature:done`). Подписка: `onDynamic`, эмит: `emitDynamic`.

```ts
import { Endge } from '@endge/core'

// Подписка на кастомное событие
const unwatch = Endge.events.onDynamic('app:user-login', (e) => {
  console.log('Вход:', e.payload)
})

// Эмит из другого места приложения
Endge.events.emitDynamic('app:user-login', { userId: '123', at: Date.now() })

// Отписка
unwatch()
```

Подписка на несколько имён сразу:

```ts
Endge.events.onDynamic(['app:save', 'app:publish'], (e) => {
  console.log('Событие:', e.payload)
})
```

---

## Кеш событий (отладка)

При необходимости можно включить кеш последних событий и смотреть их в отладчике или через консольную команду:

- **`Endge.events.setCacheSize(n)`** - включить кеш на `n` последних событий (`0` - выключить).
- **`Endge.events.lastEvents`** - снимок кеша (oldest → newest): `{ name, payload, at }[]`.
- **`Endge.events.cachedCount`** / **`Endge.events.cacheSize`** - текущее количество и вместимость.
- **`Endge.events.clearCache()`** - очистить кеш.

Использование в коде: после `setCacheSize(100)` подписчики (например, UI отладки) могут читать `Endge.events.lastEvents` для отображения ленты событий.
