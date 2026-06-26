# Федерации и модули

`Endge` и `AppCore` работают как статические федерации.

Федерация:
- наследуется от `EndgeFederation`
- существует в единственном экземпляре через `globalThis`
- используется только статически, без `new`
- хранит модули в порядке регистрации
- вызывает lifecycle в том же порядке, без топологической сортировки

## Pipeline федерации

Порядок вызовов:
1. `setup()`
2. `loadFromStorage()`
3. `init()`
4. `reset()`

`setup()` выполняется один раз перед первым `init()`.  
`init()` запускает рабочую инициализацию модулей.  
`reset()` сбрасывает runtime-состояние федерации и модулей.

## Допустимые методы федерации

Основные публичные статические методы федерации:
- `registerModule(key, module)` - регистрирует модуль
- `setup()` - вызывает `setup()` у всех модулей
- `init()` - инициализирует федерацию
- `reset()` - вызывает `reset()` у всех модулей
- `saveToStorage()` - собирает `serialize()` по всем модулям
- `loadFromStorage()` - вызывает `deserialize(payload)` по всем модулям

Внутренне федерация также использует:
- `initModules()`
- `resetModules()`
- `runInitialization()`

## EndgeModule

Каждый модуль:
- наследуется от `EndgeModule`
- является `Subscribable`
- может вызывать `notify()` для реактивного обновления подписчиков

Допустимые методы модуля:
- `setup()` - подготовка зависимостей и runtime-структур
- `init()` - основная инициализация после гидрации
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
class AppCore extends EndgeFederation {
  protected static override readonly federationId = 'app-core'
  protected static override readonly storageKey = 'app:settings'

  protected static override configureFederation(): void {
    this.registerModule('domain', new AppDomain())
  }
}

class AppDomain extends EndgeModule {
  public reset(): void {
    this.notify()
  }

  public serialize(): unknown {
    return {}
  }

  public deserialize(payload: unknown): void {
    void payload
  }
}
```
