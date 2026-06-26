# AppCore integrations

`AppCore.init()` связывает три уровня запуска:

- `Endge.init(...)` - инициализация ядра и домена;
- `EndgeVue.init()` - подключение Vue-рендеров и watch-фаз;
- `Endge.runtime.init()` - запуск runtime-подсистемы вычислений.

Это обеспечивает единый вход в экосистему: ядро -> UI-слой -> прикладной runtime.
