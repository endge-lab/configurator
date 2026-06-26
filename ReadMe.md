pnpm remove toposort axios yaml graphql @vue/compiler-dom uuid @babel-parser he @babel/traverse @babel/types date-fns date-fns-tz
pnpm remove -D sass-embedded

Admin debug routes:
- `/admin?guardTest=1` - принудительно триггерит аварийный `AppRenderGuard` для проверки, что глобальный предохранитель корректно перехватывает рекурсивные обновления и снимает админку из рендера.
- `/admin?noTooltips=1` - открывает админку с полностью отключенным tooltip-слоем (`TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent`) для быстрой проверки, не является ли tooltip-инфраструктура источником production-цикла.
- `/admin?noWidgets=1` - открывает админку без модуля admin-виджетов, чтобы быстро проверить, не рождается ли цикл на старте grid/widget layout.
- `/admin?noRuntimeDebugger=1` - открывает админку без запуска `Endge.runtimeDebugger`, чтобы исключить канал runtime-debug из production-цикла.
- `/admin?plainAdmin=1` - открывает админку без `grid`-layout, чтобы проверить, не рождается ли recursive update в layout-обвязке, widget-channel, resize-state или телепортах шапки.
- `/admin?noTabStorage=1` - открывает админку без чтения и сохранения `endge-editor-tabs`, чтобы исключить восстановление битого persisted-состояния вкладок.



ToDo:
- Raph watch dispose при unmount ref ссылки
- При запуске удалить вкладки с ошибками или удаленные
