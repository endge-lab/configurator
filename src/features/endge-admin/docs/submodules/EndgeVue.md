# Federation EndgeVue

`EndgeVue` - интеграционный слой между ядром `Endge` и Vue-приложением.

В `EndgeVue.init()` выполняются регистрации:
- рендеров в `Endge.render` (например, `Table`, `DSL`);
- JSX-компонентов (`Layout`, `Flex`, `Box`, `Component`, `Text`, `DateTime`, `Icon`);
- фазы `watch` в `Raph` для синхронизации реактивных `ref` с путями графа.

Практический смысл:
- ядро `Endge` остается UI-агностичным;
- слой `EndgeVue` подключает конкретную реализацию отображения и реактивности Vue.
