# EndgeDiagnostics

`EndgeDiagnostics` - новый модуль ядра Endge для системной диагностики и мониторинга runtime.

Он не знает ничего про Vue, DOM, devtools, админские виджеты и браузерные инспекторы. Его задача - быть единым источником диагностической истины на уровне ядра.

## Зачем нужен

Старый `Endge.debug` закрывает задачу локальной трассировки и developer-oriented debug tooling.

`EndgeDiagnostics` решает более широкую и более строгую задачу:

- собирать диагностические записи ядра по единому контракту;
- связывать их через `traceId / spanId / parentSpanId`;
- хранить их в быстром in-memory буфере;
- давать стабильный read-model API для будущих UI, exporters и remote integrations;
- вводить policy-слой: что собирать, сколько хранить и что отбрасывать.

Иными словами:

- `Endge.debug` - локальная отладка;
- `EndgeDiagnostics` - платформенная диагностика и observability-основа.

## Ключевая терминология

### Record

`Record` - минимальная единица диагностических данных.

В модуле есть несколько типов записей:

- `trace-start`
- `trace-end`
- `span-start`
- `span-end`
- `event`
- `measurement`
- `snapshot`

### Trace

`Trace` - верхнеуровневая операция.

Примеры:

- `domain.compile`
- `runtime.execute`
- `query.run`

Trace нужен, чтобы собрать в одну причинно-связанную цепочку все вложенные спаны, события и измерения одной операции.

### Span

`Span` - интервал внутри trace.

Примеры:

- `resolve-bindings`
- `build-request`
- `hydrate-runtime`

Спан фиксирует длительность конкретного участка работы.

### Event

`Event` - мгновенный факт внутри trace или span.

### Measurement

`Measurement` - числовое измерение.

### Snapshot

`Snapshot` - зафиксированный срез состояния.

### Correlation

`Correlation` - связка идентификаторов:

- `traceId`
- `spanId`
- `parentSpanId`

### Channel

`Channel` - диагностический канал или подсистема.

Примеры:

- `runtime`
- `domain`
- `bindings`
- `query`
- `events`

### Attrs

`Attrs` - плоские метаданные записи.

### EntityRef

`EntityRef` - ссылка на сущность ядра.

### ContextRef

`ContextRef` - технический контекст выполнения.

Примеры полей:

- `module`
- `runtimeId`
- `project`
- `environment`
- `tenantId`
- `userId`
- `sessionId`

## Архитектура модуля

`EndgeDiagnostics` состоит из пяти частей.

### 1. Capture API

Это write-side API:

- `beginTrace(...)`
- `startSpan(...)`
- `writeEvent(...)`
- `writeMeasurement(...)`
- `writeSnapshot(...)`
- `writeSpanEnd(...)`
- `writeTraceEnd(...)`

### 2. Scope Handles

Публичные классы:

- `DiagnosticsTrace`
- `DiagnosticsSpan`

Они нужны, чтобы не держать глобальный mutable stack на весь модуль.

### 3. Policy Layer

Policy управляет стоимостью и поведением модуля:

- `enabled`
- `levelThreshold`
- `sampleRate`
- `maxRecords`
- `includeChannels`
- `excludeChannels`
- `exportersEnabled`
- `persistPolicy`

### 4. In-Memory Store

Внутри модуля используется быстрый кольцевой буфер с индексами.

Он индексирует записи по:

- `traceId`
- `entity`
- `channel`

### 5. Read Model

Это read-side API:

- `getRecord(id)`
- `getRecords(limit?)`
- `getTraceRecords(traceId, limit?)`
- `getEntityRecords(type, id, limit?)`
- `queryRecords(...)`
- `getCounters()`
- `snapshot(...)`

## Почему модуль не зависит от Vue

Потому что это модуль ядра.

Его ответственность:

- принять сигнал;
- нормализовать его;
- сохранить;
- отдать через API.

Его ответственность не включает:

- отрисовку;
- devtools integration;
- DOM inspection;
- page screenshots;
- widgets;
- tabs.

## Производительность

При проектировании модуля заложены такие принципы:

- ограниченный memory footprint через `maxRecords`;
- дешёвое вытеснение по кольцевой схеме;
- индексы только по действительно полезным ключам;
- батчинг `notify()` через `queueMicrotask`;
- явные handles вместо глобального стека.

## Exporters

Модуль уже содержит базовый контракт exporter:

- `registerExporter(...)`
- `unregisterExporter(...)`
- `flushExporters(...)`

Сейчас exporters не встроены в pipeline автоматически и не используются приложением.

## Текущий статус

Модуль:

- зарегистрирован в федерации Endge;
- доступен как `Endge.diagnostics`;
- выключен по умолчанию через policy `enabled: false`;
- не интегрирован в текущие runtime-процессы;
- не подменяет `Endge.debug`;
- не используется UI автоматически.

Это сознательный режим `shadow module`: контракт уже существует, а потребители будут подключаться позже.
