# EndgeVue plugin

`EndgeVuePlugin` - интеграционный plugin между ядром `Endge` и Vue-приложением.

Plugin регистрирует `EndgeVueModule` перед модулем `runtime`.

`EndgeVueModule` registers the native Vue SFC adapter in `Endge.uiRegistry`.
Legacy Table/DSL renderers and their JSX runtime are not part of this package anymore.

Практический смысл:
- ядро `Endge` остается UI-агностичным;
- слой `EndgeVue` подключает конкретную Vue-реализацию для SFC components.
