# Federation AppCore

`AppCore` - прикладная федерация orchestration-уровня. Она управляет запуском приложения поверх `Endge` и `EndgeVue`.

В `AppCore`:
- регистрируется прикладной модуль `domain` (`AppDomain`);
- задается bootstrap-пайплайн конфигуратора;
- выполняется интеграция `Endge.init()`, `EndgeVue.init()` и `Endge.runtime.init()`.
