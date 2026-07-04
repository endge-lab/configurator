import type { SmartTabRef } from '@/components/ui/smart-tabs/types.ts'
import type { DocsEntry } from '@/features/endge-admin/domain/types/docs.types.ts'
import type { Ref } from 'vue'

import { DocsCategory } from '@/features/endge-admin/domain/types/docs.types.ts'
import { ref } from 'vue'

const DOCS_VIEW_ID = 'endge-docs-viewer'

/**
 * Модуль документации: управление записями документации и их категориями.
 */
export class EndgeAdminDocs {
  private _entries: DocsEntry[] = []
  private _activeCategory = ref<DocsCategory | null>(DocsCategory.HowToUse)
  private _activeEntryId = ref<string | null>(null)

  public init(): void {
    this._entries = [
      {
        id: 'nova-overview',
        title: 'NOVA: обзор',
        description: 'Что такое NOVA, где использовать и как устроен пакет.',
        icon: 'ti ti-square',
        file: 'nova/1_Overview',
        category: DocsCategory.Nova,
      },
      {
        id: 'nova-quick-start',
        title: 'Быстрый старт',
        description: 'Минимальная интеграция NOVA в вкладке/виджете и первый кадр.',
        icon: 'ti ti-rocket',
        file: 'nova/2_QuickStart',
        category: DocsCategory.Nova,
      },
      {
        id: 'nova-core-concepts',
        title: 'Основные понятия',
        description: 'NovaGraph, App, Surface, Node, рендереры и жизненный цикл.',
        icon: 'ti ti-hierarchy-2',
        file: 'nova/3_CoreConcepts',
        category: DocsCategory.Nova,
      },
      {
        id: 'nova-rendering-2d',
        title: 'Рендеринг 2D',
        description: 'Схема примитивов, трансформации, текст и клиппинг.',
        icon: 'ti ti-brush',
        file: 'nova/4_Rendering2D',
        category: DocsCategory.Nova,
      },
      {
        id: 'nova-events',
        title: 'События и интерактивность',
        description: 'Hit-test, drag/click/wheel и подписка на события узлов.',
        icon: 'ti ti-pointer',
        file: 'nova/5_EventsAndInteraction',
        category: DocsCategory.Nova,
      },
      {
        id: 'nova-examples',
        title: 'Практический пример',
        description: 'Пошаговый пример с красным квадратом и обновлением по данным.',
        icon: 'ti ti-code',
        file: 'nova/6_Examples',
        category: DocsCategory.Nova,
      },
      {
        id: 'how-to-use-views',
        title: 'Виды',
        description: 'Отображение вида (таблица + запрос + фильтр) на странице приложения.',
        icon: 'ti ti-eye',
        file: 'how-to-use/Views',
        category: DocsCategory.HowToUse,
      },
      {
        id: 'architecture-headless-runtime-optional-presentation',
        title: 'Headless Runtime и Optional Presentation',
        description: 'Разделение runtime-жизни сущности и её визуализации как двух независимых фасетов.',
        icon: 'ti ti-device-desktop-code',
        file: 'architecture-concepts/HeadlessRuntimeOptionalPresentation',
        category: DocsCategory.ArchitectureConcepts,
      },
      {
        id: 'architecture-hierarchical-faceted-configuration-cascade',
        title: 'Hierarchical Faceted Configuration Cascade',
        description: 'Иерархия контекстов, фасеты и каскад переопределений UI и behavior.',
        icon: 'ti ti-layers-linked',
        file: 'architecture-concepts/HierarchicalFacetedConfigurationCascade',
        category: DocsCategory.ArchitectureConcepts,
      },
      {
        id: 'architecture-presentation-facets-and-renderers',
        title: 'Presentation Facets и Renderer Bindings',
        description: 'Как универсально прикреплять renderers к сущностям без смешения с runtime-логикой.',
        icon: 'ti ti-palette',
        file: 'architecture-concepts/PresentationFacetsAndRenderers',
        category: DocsCategory.ArchitectureConcepts,
      },
      {
        id: 'roadmap-overview',
        title: 'Roadmap: обзор',
        description: 'Сводный документ: структура roadmap, принципы, таблица направлений, приоритеты, риски и зависимости.',
        icon: 'ti ti-list-check',
        file: 'roadmap/00_Roadmap_Overview',
        category: DocsCategory.ProjectRoadmap,
      },
      {
        id: 'roadmap-core-refactoring-and-feature-modularization',
        title: 'Рефакторинг ядра и разделение на фичи',
        description: 'Краткая сводка по анализу @endge/core и вектору перехода к feature-модульности.',
        icon: 'ti ti-route-alt-left',
        file: 'roadmap/Core_Refactoring_And_Feature_Modularization',
        category: DocsCategory.ProjectRoadmap,
      },
      {
        id: 'roadmap-edb-immutable-data-module',
        title: 'EDB: модуль неизменяемых данных',
        description: 'Почему платформе нужен отдельный слой локальных справочников, индексов и быстрого lookup-доступа.',
        icon: 'ti ti-database-cog',
        file: 'roadmap/EDB_Immutable_Data_Module',
        category: DocsCategory.ProjectRoadmap,
      },
      {
        id: 'roadmap-diagnostics-logging-telemetry',
        title: 'Модуль диагностики: логирование и телеметрия',
        description: 'Доработка Endge.diagnostics: объединение с логированием, телеметрия Nova и приложения, экспортеры.',
        icon: 'ti ti-activity-heartbeat',
        file: 'roadmap/Diagnostics_Logging_Telemetry',
        category: DocsCategory.ProjectRoadmap,
      },
      {
        id: 'roadmap-error-handling',
        title: 'Обработка ошибок',
        description: 'Централизованная обработка ошибок, контракт типов, интеграция с диагностикой, error boundary.',
        icon: 'ti ti-alert-triangle',
        file: 'roadmap/Error_Handling',
        category: DocsCategory.ProjectRoadmap,
      },
      {
        id: 'roadmap-configuration-feature-flags',
        title: 'Конфигурация и feature flags',
        description: 'Единый модуль конфигурации: env, feature flags, типизация и при необходимости remote config.',
        icon: 'ti ti-adjustments',
        file: 'roadmap/Configuration_And_Feature_Flags',
        category: DocsCategory.ProjectRoadmap,
      },
      {
        id: 'roadmap-rbac-policies-audit',
        title: 'RBAC, политики и аудит',
        description: 'Права доступа (роли, политики), проверки в UI и API; аудит действий пользователя.',
        icon: 'ti ti-shield-lock',
        file: 'roadmap/RBAC_Policies_And_Audit',
        category: DocsCategory.ProjectRoadmap,
      },
      {
        id: 'roadmap-notifications',
        title: 'Уведомления',
        description: 'Единый слой уведомлений (toast): фасад, типы, связь с обработкой ошибок и брендингом.',
        icon: 'ti ti-bell',
        file: 'roadmap/Notifications',
        category: DocsCategory.ProjectRoadmap,
      },
      {
        id: 'roadmap-modal-registry',
        title: 'Регистр модальных окон',
        description: 'Единый регистр и API вызова модалов по id из любого места, по аналогии с тостами.',
        icon: 'ti ti-window',
        file: 'roadmap/Modal_Registry',
        category: DocsCategory.ProjectRoadmap,
      },
      {
        id: 'roadmap-session-settings-storage',
        title: 'Настройки в привязке к сессии пользователя',
        description: 'Хранение всех сериализуемых настроек по сессии; очистка по пользователю/сессии; версионирование и автосброс при повреждении.',
        icon: 'ti ti-device-floppy',
        file: 'roadmap/Session_Settings_Storage',
        category: DocsCategory.ProjectRoadmap,
      },
      {
        id: 'roadmap-variables-env-override',
        title: 'Переопределение переменных настроек через env (высокий приоритет)',
        description: 'Явный контракт: переменные из settings.vars переопределяются через окружение (VITE_*, ENVY, runtime env), если в среде задано значение.',
        icon: 'ti ti-variable',
        file: 'roadmap/Variables_Env_Override',
        category: DocsCategory.ProjectRoadmap,
      },
      {
        id: 'roadmap-health-checks',
        title: 'Health checks и статус платформы',
        description: 'Readiness/liveness на бэкенде; проверка доступности API на фронте при старте; экран «Сервис недоступен» вместо белого экрана.',
        icon: 'ti ti-heartbeat',
        file: 'roadmap/Health_Checks_And_Platform_Status',
        category: DocsCategory.ProjectRoadmap,
      },
      {
        id: 'roadmap-backup-restore-policies',
        title: 'Резервное копирование и восстановление (политики)',
        description: 'Политики бэкапов: частота, retention, хранение; автоматизация; процедуры восстановления и RPO/RTO.',
        icon: 'ti ti-backup',
        file: 'roadmap/Backup_Restore_Policies',
        category: DocsCategory.ProjectRoadmap,
      },
      {
        id: 'roadmap-versioning-updates',
        title: 'Версионирование и обновления',
        description: 'Версионирование API и конфигурации; политика обновлений, release notes, откат, матрица совместимости.',
        icon: 'ti ti-versions',
        file: 'roadmap/Versioning_And_Updates',
        category: DocsCategory.ProjectRoadmap,
      },
      {
        id: 'roadmap-virtualization-lists-tables',
        title: 'Виртуализация списков и тяжёлых таблиц',
        description: 'Производительность: виртуализация больших списков и таблиц; RevoGrid и VirtualList; стандарт платформы по порогу элементов.',
        icon: 'ti ti-list-numbers',
        file: 'roadmap/Virtualization_Of_Lists_And_Tables',
        category: DocsCategory.ProjectRoadmap,
      },
      {
        id: 'roadmap-bundle-optimization-tenant-isolation',
        title: 'Оптимизация бандла и изоляция tenant',
        description: 'Code splitting, ленивая загрузка; не допускать попадания сущностей одной компании в бандл/контекст другой.',
        icon: 'ti ti-package',
        file: 'roadmap/Bundle_Optimization_And_Tenant_Isolation',
        category: DocsCategory.ProjectRoadmap,
      },
      {
        id: 'roadmap-accessibility-a11y',
        title: 'Доступность (a11y)',
        description: 'WCAG 2.1 AA: теория, семантика, клавиатура, ARIA; как вписать в архитектуру Endge; план внедрения по этапам.',
        icon: 'ti ti-accessibility',
        file: 'roadmap/Accessibility_A11y',
        category: DocsCategory.ProjectRoadmap,
      },
      {
        id: 'if-else',
        title: 'If-Else',
        description: 'Условное отображение элементов в DSL-компонентах.',
        icon: 'pi pi-code',
        file: 'jsx/IfElse',
        category: DocsCategory.EndgeComponents,
      },
      {
        id: 'common-styles',
        title: 'Общие стили компонентов',
        description:
          'Все универсальные атрибуты для изменения внешнего вида любого компонента.',
        icon: 'ti ti-palette',
        file: 'jsx/Styles',
        category: DocsCategory.EndgeComponents,
      },
      {
        id: 'tooltip-system',
        title: 'Tooltip (Подсказки)',
        description:
          'Система отображения подсказок (tooltip) через атрибуты или слот #tooltip для любого компонента DSL.',
        icon: 'ti ti-tooltip',
        file: 'jsx/Tooltips',
        category: DocsCategory.EndgeComponents,
      },
      {
        id: 'flex',
        title: 'Flex',
        description: 'Упрощённый компонент для гибкой верстки',
        icon: 'ti ti-layout-navbar',
        file: 'jsx/Flex',
        category: DocsCategory.EndgeComponents,
      },
      {
        id: 'box',
        title: 'Box',
        description: 'Пустой контейнер для обёртки других элементов',
        icon: 'ti ti-box',
        file: 'jsx/Box',
        category: DocsCategory.EndgeComponents,
      },
      {
        id: 'layout',
        title: 'Layout',
        description: 'Компонент для создания макета (расширенный)',
        icon: 'ti ti-layout',
        file: 'jsx/Layout',
        category: DocsCategory.EndgeComponents,
      },
      {
        id: 'text',
        title: 'Text',
        description: 'Компонент для отображения текста с гибкими настройками',
        icon: 'ti ti-align-left',
        file: 'jsx/Text',
        category: DocsCategory.EndgeComponents,
      },
      {
        id: 'datetime',
        title: 'DateTime',
        description:
          'Компонент для форматированного отображения даты с учётом таймзоны.',
        icon: 'ti ti-calendar',
        file: 'jsx/DateTime',
        category: DocsCategory.EndgeComponents,
      },
      {
        id: 'styling-general',
        title: 'Общие сведения',
        description:
          'Принцип назначения классов и атрибутов endge-* тегам и компонентам в DOM.',
        icon: 'ti ti-paint',
        file: 'jsx/Styling',
        category: DocsCategory.Styling,
      },
      {
        id: 'converters',
        title: 'Конвертеры',
        description: 'Создание конвертеров в домене и привязка обработчиков через Endge.bind.converter.',
        icon: 'ti ti-arrow-left-right',
        file: 'Converters',
        category: DocsCategory.EndgeDomain,
      },
      { id: 'domain-type', title: 'Type (Тип)', description: 'Тип данных: имя и набор полей.', icon: 'ti ti-type', file: 'domain/Type', category: DocsCategory.EndgeDomain },
      { id: 'domain-query', title: 'Query (Запрос)', description: 'Запрос к данным: тип, параметры, фильтры.', icon: 'ti ti-database-search', file: 'domain/Query', category: DocsCategory.EndgeDomain },
      { id: 'domain-component', title: 'Component (Компонент)', description: 'Компонент отображения: таблица, DSL.', icon: 'ti ti-layout-grid', file: 'domain/Component', category: DocsCategory.EndgeDomain },
      { id: 'domain-scenario', title: 'Scenario (Сценарий)', description: 'Сценарий: последовательность шагов, бизнес-логика.', icon: 'ti ti-route', file: 'domain/Scenario', category: DocsCategory.EndgeDomain },
      { id: 'domain-parameter', title: 'Parameter (Параметр)', description: 'Параметр: идентификатор, тип, значения.', icon: 'ti ti-adjustments', file: 'domain/Parameter', category: DocsCategory.EndgeDomain },
      { id: 'domain-filter', title: 'Filter (Фильтр)', description: 'Фильтр данных: поля, условия, конвертеры.', icon: 'ti ti-filter', file: 'domain/Filter', category: DocsCategory.EndgeDomain },
      { id: 'domain-converter', title: 'Converter (Конвертер)', description: 'Преобразование значения из одного типа в другой.', icon: 'ti ti-arrow-left-right', file: 'domain/Converter', category: DocsCategory.EndgeDomain },
      { id: 'domain-integration', title: 'Integration (Интеграция)', description: 'Интеграция с внешней системой или API.', icon: 'ti ti-plug', file: 'domain/Integration', category: DocsCategory.EndgeDomain },
      { id: 'domain-view', title: 'View (Представление)', description: 'Представление: конфигурация отображения или набора данных.', icon: 'ti ti-eye', file: 'domain/View', category: DocsCategory.EndgeDomain },
      { id: 'domain-folder', title: 'Folder (Папка)', description: 'Папка для группировки сущностей в дереве.', icon: 'ti ti-folder', file: 'domain/Folder', category: DocsCategory.EndgeDomain },
      { id: 'domain-settings', title: 'Settings (Настройки)', description: 'Глобальные настройки приложения.', icon: 'ti ti-settings', file: 'domain/Settings', category: DocsCategory.EndgeDomain },
      { id: 'domain-version', title: 'Version (Версия)', description: 'Версия домена или снимок конфигурации.', icon: 'ti ti-versions', file: 'domain/Version', category: DocsCategory.EndgeDomain },
      { id: 'submodules-federation', title: 'Федерации и модули', description: 'Общая модель EndgeFederation/EndgeModule: lifecycle, persistence и порядок вызовов.', icon: 'ti ti-hierarchy-2', file: 'submodules/Federation', category: DocsCategory.EndgeSubModules },
      { id: 'submodules-endge-vue', title: 'EndgeVue plugin', description: 'Plugin @endge/vue: registrations render-компонентов и фаз Raph.', icon: 'ti ti-brand-vue', file: 'submodules/EndgeVue', category: DocsCategory.EndgeSubModules },
      { id: 'submodules-app-core', title: 'AppCore', description: 'Прикладная точка запуска: Endge.use(EndgeVuePlugin) и Endge.boot(ctx).', icon: 'ti ti-layers-linked', file: 'submodules/AppCore', category: DocsCategory.EndgeSubModules },
      { id: 'submodules-app-core-bootstrap', title: 'AppCore boot', description: 'Pipeline инициализации конфигуратора через Endge.boot(ctx).', icon: 'ti ti-route-2', file: 'submodules/AppCoreBootstrap', category: DocsCategory.EndgeSubModules },
      { id: 'submodules-app-core-integration', title: 'AppCore integrations', description: 'Связка Endge.use(EndgeVuePlugin) + Endge.boot(ctx).', icon: 'ti ti-link', file: 'submodules/AppCoreIntegration', category: DocsCategory.EndgeSubModules },
      { id: 'submodules-context', title: 'Endge.context', description: 'Текущий проект, среда и локаль runtime-контекста.', icon: 'ti ti-app-window', file: 'submodules/Context', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-diagnostics', title: 'Endge.diagnostics', description: 'Новый модуль системной диагностики и мониторинга ядра.', icon: 'ti ti-activity-heartbeat', file: 'core-modules/EndgeDiagnostics', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-debug', title: 'Endge.debug', description: 'Отладочная трассировка (спаны) операций.', icon: 'ti ti-bug', file: 'submodules/Debug', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-testing', title: 'Endge.testing', description: 'Режим тестирования и опции тестов.', icon: 'ti ti-vial', file: 'submodules/Testing', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-domain', title: 'Endge.domain', description: 'Хранилище reflect-сущностей и доменной конфигурации.', icon: 'ti ti-database', file: 'submodules/Domain', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-runtime-entities', title: 'Runtime-сущности', description: 'Живые runtime-host объекты и их отличие от domain entity.', icon: 'ti ti-box-multiple', file: 'submodules/RuntimeEntities', category: DocsCategory.EndgeSubModules },
      { id: 'submodules-vocabs', title: 'Endge.vocabs', description: 'Словари и справочники по namespace.', icon: 'ti ti-book', file: 'submodules/Vocabs', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-extract', title: 'Endge.extract', description: 'Извлечение данных из источников.', icon: 'ti ti-file-export', file: 'submodules/Extract', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-render', title: 'Endge.render', description: 'Рендеринг UI по доменным компонентам.', icon: 'ti ti-palette', file: 'submodules/Render', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-store', title: 'Endge.store', description: 'Хранилище состояния приложения.', icon: 'ti ti-stack', file: 'submodules/Store', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-script', title: 'Endge.script', description: 'Объявление JSX и сценариев.', icon: 'ti ti-code', file: 'submodules/Script', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-runtime', title: 'Endge.runtime', description: 'Жизнь runtime-host поверх Raph и исполнение фаз.', icon: 'ti ti-cpu', file: 'submodules/Runtime', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-communication-layers', title: 'Слои коммуникации', description: 'Как Raph, runtime host, contracts, bindings и event bus разделены по ролям.', icon: 'ti ti-layers-intersect', file: 'submodules/CommunicationLayers', category: DocsCategory.EndgeSubModules },
      { id: 'submodules-event-contracts', title: 'Контракты событий', description: 'Каталог допустимых событий, scope и связь с UI-конфигуратором.', icon: 'ti ti-list-details', file: 'submodules/EventContracts', category: DocsCategory.EndgeSubModules },
      { id: 'submodules-event-flow', title: 'Поток событий и реакций', description: 'Как runtime, contracts, bindings, actions и bus работают вместе.', icon: 'ti ti-route-2', file: 'submodules/EventFlow', category: DocsCategory.EndgeSubModules },
      { id: 'submodules-vars', title: 'Endge.vars', description: 'Переменные и подстановка значений.', icon: 'ti ti-variable', file: 'submodules/Vars', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-query', title: 'Endge.query', description: 'API запросов на уровне ядра.', icon: 'ti ti-database-search', file: 'submodules/Query', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-auth', title: 'Endge.auth', description: 'Аутентификация и токены.', icon: 'ti ti-lock', file: 'submodules/Auth', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-schema', title: 'Endge.schema', description: 'Схема и хранилище (Payload, документы).', icon: 'ti ti-schema', file: 'submodules/Schema', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-flow', title: 'Endge.flow', description: 'Исполнение action-flow через run/runBlock и runtime host.', icon: 'ti ti-bolt', file: 'submodules/Flow', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-updates', title: 'Endge.updates', description: 'Поток обновлений и синхронизация с сервером.', icon: 'ti ti-refresh', file: 'submodules/Updates', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-events', title: 'Endge.events', description: 'Runtime-шина: transport для подписки и эмита в коде.', icon: 'ti ti-broadcast', file: 'submodules/Events', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-sse', title: 'Endge.sse', description: 'Server-Sent Events: приём сообщений с сервера.', icon: 'ti ti-antenna', file: 'submodules/Sse', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-ui', title: 'Endge.ui', description: 'Утилиты и состояние UI.', icon: 'ti ti-devices', file: 'submodules/Ui', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-reports', title: 'Endge.reports', description: 'Формирование и экспорт отчётов.', icon: 'ti ti-report', file: 'submodules/Reports', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-bindings', title: 'Endge.behaviorBindings', description: 'Declarative behavior bindings: resolver, dispatch и запуск actions.', icon: 'ti ti-link', file: 'submodules/Bindings', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-bind', title: 'Endge.bind', description: 'Программная подмена кода у converter/action/runtime step.', icon: 'ti ti-code-plus', file: 'submodules/Bind', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-console', title: 'Endge.console', description: 'Консоль разработчика: регистрация команд.', icon: 'ti ti-terminal', file: 'submodules/Console', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-runtime-debugger', title: 'Endge.runtimeDebugger', description: 'Отладка вкладок: канал и список вкладок.', icon: 'ti ti-brand-chrome', file: 'submodules/RuntimeDebugger', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-styles', title: 'Endge.styles', description: 'Инициализация стилей, CSS-токенов и синхронизация с доменными style-документами.', icon: 'ti ti-brush', file: 'submodules/Styles', category: DocsCategory.EndgeCoreModules },
      { id: 'jsx-component', title: 'Component', description: 'DSL-компонент для встраивания вложенных доменных компонентов.', icon: 'ti ti-cube', file: 'jsx/Component', category: DocsCategory.EndgeComponents },
      { id: 'jsx-icon', title: 'Icon', description: 'DSL-компонент иконок через JSXRender_Icon.', icon: 'ti ti-icons', file: 'jsx/Icon', category: DocsCategory.EndgeComponents },
      { id: 'plugins-dsl-playground', title: 'DSL Playground', description: 'Песочница для проверки JSX-разметки с превью в реальном времени.', icon: 'ti ti-device-gamepad-3', file: 'Plugins_DSL_Playground', category: DocsCategory.Configuring },
      { id: 'plugins-generator', title: 'Генератор', description: 'Создание фильтра, запроса, таблицы и вида по таблице полей.', icon: 'ti ti-forms', file: 'Plugins_Generator', category: DocsCategory.Configuring },
      { id: 'widgets', title: 'Виджеты', description: 'Список виджетов админки: Домен, Инспектор, Документация и др.', icon: 'ti ti-layout-sidebar', file: 'Widgets', category: DocsCategory.Configuring },
      { id: 'codegen-overview', title: 'Codegen: обзор', description: 'Что именно генерируется из домена, как связаны базовые Endge*Id и EndgeGen.*Id.', icon: 'ti ti-code-dots', file: 'codegen/Overview', category: DocsCategory.Codegen },
      { id: 'codegen-chrome-extension', title: 'Расширение Chrome', description: 'Установка unpacked-расширения, подключение к вкладке платформы и запуск генерации.', icon: 'ti ti-brand-chrome', file: 'codegen/ChromeExtension', category: DocsCategory.Codegen },
      { id: 'codegen-utility', title: 'Утилита Codegen', description: 'Локальный listener, команды запуска и примеры результата в src/gen.', icon: 'ti ti-terminal-2', file: 'codegen/Utility', category: DocsCategory.Codegen },
    ]
  }

  public reset(): void {
    this._entries = []
    this._activeCategory.value = DocsCategory.HowToUse
    this._activeEntryId.value = null
  }

  /**
   * ACCESS
   */

  public get entries(): DocsEntry[] {
    return this._entries
  }

  /** ACCESS */
  public get activeCategory(): Ref<DocsCategory | null> {
    return this._activeCategory
  }

  /** ACCESS */
  public get activeEntryId(): Ref<string | null> {
    return this._activeEntryId
  }

  public getEntriesByCategory(category: DocsCategory): DocsEntry[] {
    return this._entries.filter(entry => entry.category === category)
  }

  public getEntryById(id: string): DocsEntry | null {
    return this._entries.find(entry => entry.id === id) ?? null
  }

  public getEntriesByCategoryMap(): Map<DocsCategory, DocsEntry[]> {
    const map = new Map<DocsCategory, DocsEntry[]>()
    this._entries.forEach((entry) => {
      const arr = map.get(entry.category) || []
      arr.push(entry)
      map.set(entry.category, arr)
    })
    return map
  }

  /** Фиксированный id единственной вкладки документации (обновляется при смене пункта). */
  public static readonly DOCS_TAB_ID = 'docs'

  public setActiveCategory(category: DocsCategory | null): void {
    this._activeCategory.value = category
  }

  public selectEntry(entryId: string): void {
    const entry = this.getEntryById(entryId)
    if (!entry)
      return
    this._activeEntryId.value = entry.id
    this._activeCategory.value = entry.category
  }

  /**
   * Дескриптор вкладки документации. Вкладка одна - при повторном вызове с другим entryId обновляет её контент.
   */
  public openDocumentTab(entryId: string): SmartTabRef | null {
    const entry = this.getEntryById(entryId)
    if (!entry)
      return null
    this._activeEntryId.value = entry.id
    this._activeCategory.value = entry.category
    return {
      id: EndgeAdminDocs.DOCS_TAB_ID,
      label: entry.title,
      viewId: DOCS_VIEW_ID,
      payload: { docId: entry.id, file: entry.file, title: entry.title },
      closable: true,
      meta: { icon: 'ti ti-file-text text-xl' },
    }
  }
}

export { DOCS_VIEW_ID }
