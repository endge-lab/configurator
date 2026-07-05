# AppCore integrations

`AppCore.init()` связывает три уровня запуска:

- `Endge.use(EndgeVuePlugin)` - подключение Vue-модуля как plugin ядра;
- `Endge.boot(ctx)` - централизованный запуск ядра по фазам `setup -> load -> build -> start`.

Это обеспечивает единый вход в экосистему: ядро -> UI-слой.
