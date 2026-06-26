# AppCore bootstrap

`AppCore` регистрирует шаги bootstrap через `Endge.bootstrap.registerSteps(...)`.

Основные шаги:
1. инициализация `Endge`;
2. подключение `EndgeVue`;
3. запуск `Endge.runtime`;
4. загрузка plain/payload-домена и `Endge.domain.compile()`.

Такой pipeline позволяет инициализировать только нужный уровень готовности.
