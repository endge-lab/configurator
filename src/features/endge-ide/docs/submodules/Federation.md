# Федерации и модули

`Endge` работает как статическая федерация модулей. `AppCore` остается отдельной прикладной точкой запуска и не является федерацией.

Федерация:
- наследуется от `EndgeFederation`
- существует в единственном экземпляре через `globalThis`
- используется только статически, без `new`
- хранит модули в итоговом порядке после `before/after`
- вызывает lifecycle в итоговом порядке модулей

## Pipeline федерации

Порядок вызовов:
1. `setup()`
2. `load()`
3. `build()`
4. `start()`
5. `reset()`

`setup()` подготавливает зависимости и конфигурацию модулей.  
`load()` загружает или восстанавливает входные данные модулей.  
`build()` строит производные runtime-структуры из загруженных данных.  
`start()` запускает runtime-инфраструктуру модуля.  
`reset()` сбрасывает runtime-состояние федерации и модулей.

## Допустимые методы федерации

Основные публичные статические методы федерации:
- `use(plugin)` - добавляет plugin до конфигурации федерации
- `defineModule(descriptor)` - декларирует модуль во время конфигурации
- `getModule(key)` - возвращает зарегистрированный модуль
- `tryGetModule(key)` - возвращает модуль или `null`
- `hasModule(key)` - проверяет наличие модуля
- `setup(ctx)` - вызывает `setup(ctx)` у всех модулей
- `load(ctx)` - вызывает `load(ctx)` у всех модулей
- `build(ctx)` - вызывает `build(ctx)` у всех модулей
- `start(ctx)` - вызывает `start(ctx)` у всех модулей
- `reset()` - вызывает `reset()` у всех модулей
- `saveToStorage()` - собирает `serialize()` по всем модулям
- `loadFromStorage()` - вызывает `deserialize(payload)` по всем модулям

## EndgeModule

Каждый модуль:
- наследуется от `EndgeModule`
- является `Subscribable`
- может вызывать `notify()` для реактивного обновления подписчиков

Допустимые методы модуля:
- `setup()` - подготовка зависимостей и runtime-структур
- `load()` - загрузка входных данных
- `build()` - построение производных структур
- `start()` - запуск runtime-инфраструктуры
- `reset()` - сброс runtime-состояния
- `serialize()` - вернуть snapshot для сохранения
- `deserialize(payload)` - восстановить состояние из snapshot

Все эти методы опциональны.

## Persistence

Если федерации задан `storageKey`, то:
- `saveToStorage()` проходит по всем зарегистрированным модулям
- вызывает у них `serialize()`
- сохраняет результат по ключам модулей

При `loadFromStorage()` федерация:
- читает общий snapshot
- передаёт каждому модулю его часть в `deserialize(payload)`
- на время гидрации блокирует повторное сохранение

## Пример

```ts
class ProductFederation extends EndgeFederation {
  protected static override readonly federationId = 'product'

  protected static override configureFederation(): void {
    this.defineModule({ key: 'settings', module: new ProductSettings() })
  }
}
```
