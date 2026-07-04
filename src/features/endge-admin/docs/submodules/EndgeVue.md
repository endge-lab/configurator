# EndgeVue plugin

`EndgeVuePlugin` - интеграционный plugin между ядром `Endge` и Vue-приложением.

Plugin регистрирует `EndgeVueModule` перед модулем `runtime`.

В `EndgeVueModule` выполняются регистрации:
- рендеров в `Endge.uiRegistry` (например, `Table`, `DSL`);
- JSX-компонентов (`Layout`, `Flex`, `Box`, `Component`, `Text`, `DateTime`, `Icon`);
- фазы `watch` в `Raph` для синхронизации реактивных `ref` с путями графа.

Практический смысл:
- ядро `Endge` остается UI-агностичным;
- слой `EndgeVue` подключает конкретную реализацию отображения и реактивности Vue.
