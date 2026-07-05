# AppCore boot

`AppCore` запускает конфигуратор через единый `Endge.boot(ctx)`.

Основные шаги:
1. создание `EndgeBootContext`;
2. запуск `Endge.boot(ctx)`;
3. подключение `EndgeVue`.

Внутри `Endge.boot(ctx)` фазы ядра выполняются централизованно:
`setup -> load -> build -> start`.
