# AppCore.domain

В `AppCore.configureFederation()` регистрируется модуль:

```ts
this.registerModule('domain', new AppDomain())
```

`AppDomain` - прикладной слой поверх ядра `Endge.domain`, где хранится состояние и правила конкретного продукта.
