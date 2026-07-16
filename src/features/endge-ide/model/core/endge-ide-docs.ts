import type { SmartTabRef } from '@/components/ui/smart-tabs/types.ts'
import type { DocsEntry } from '@/features/endge-ide/domain/types/docs.types.ts'
import type { Ref } from 'vue'

import { DocsCategory } from '@/features/endge-ide/domain/types/docs.types.ts'
import { ref } from 'vue'

const DOCS_VIEW_ID = 'endge-docs-viewer'

/**
 * Модуль документации: управление записями документации и их категориями.
 */
export class EndgeIDEDocs {
  private _entries: DocsEntry[] = []
  private _activeCategory = ref<DocsCategory | null>(DocsCategory.HowToUse)
  private _activeEntryId = ref<string | null>(null)

  public init(): void {
    this._entries = [
      { id: 'endgecss-overview', title: 'EndgeCSS: обзор', description: 'Source-first lifecycle от RStyle/SFC до renderer backend.', icon: 'ti ti-brush', file: 'endgecss/1_Overview', category: DocsCategory.EndgeCSS },
      { id: 'endgecss-syntax', title: 'Синтаксис и значения', description: 'Rules, nesting, custom properties и ограничения языка.', icon: 'ti ti-code', file: 'endgecss/2_Syntax', category: DocsCategory.EndgeCSS },
      { id: 'endgecss-selectors', title: 'Селекторы и каскад', description: 'Abstract selectors, specificity, source order и important.', icon: 'ti ti-target', file: 'endgecss/3_Selectors', category: DocsCategory.EndgeCSS },
      { id: 'endgecss-directives', title: 'Темы и директивы', description: '@theme, @scope, @supports и отсутствие @layer.', icon: 'ti ti-adjustments', file: 'endgecss/4_Directives', category: DocsCategory.EndgeCSS },
      { id: 'endgecss-sfc', title: 'Endge SFC styles', description: 'Scoped styles, state, part и reserved slot.', icon: 'ti ti-components', file: 'endgecss/5_SFC', category: DocsCategory.EndgeCSS },
      { id: 'endgecss-dom-canvas', title: 'DOM и Canvas boundary', description: 'Materialization algorithm and renderer-neutral contract.', icon: 'ti ti-arrows-split', file: 'endgecss/6_DOM_And_Canvas', category: DocsCategory.EndgeCSS },
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
        id: 'architecture-headless-runtime-optional-presentation',
        title: 'Headless Runtime и Optional Presentation',
        description: 'Разделение runtime-жизни сущности и её визуализации как двух независимых фасетов.',
        icon: 'ti ti-device-desktop-code',
        file: 'architecture-concepts/HeadlessRuntimeOptionalPresentation',
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
        id: 'roadmap-variables-env-override',
        title: 'Переопределение переменных настроек через env (высокий приоритет)',
        description: 'Явный контракт: переменные workspace переопределяются через окружение (VITE_*, ENVY, runtime env), если в среде задано значение.',
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
        id: 'converters',
        title: 'Конвертеры',
        description: 'Создание конвертеров в домене и привязка обработчиков через Endge.bind.converter.',
        icon: 'ti ti-arrow-left-right',
        file: 'Converters',
        category: DocsCategory.EndgeDomain,
      },
      { id: 'domain-type', title: 'Type (Тип)', description: 'Тип данных: имя и набор полей.', icon: 'ti ti-type', file: 'domain/Type', category: DocsCategory.EndgeDomain },
      { id: 'domain-query', title: 'Query source', description: 'Синтаксис defineQuery: request, outputs, локальные DataView и сохранение результатов.', icon: 'ti ti-database-search', file: 'domain/Query', category: DocsCategory.EndgeDomain },
      { id: 'domain-data-view', title: 'DataView source', description: 'Синтаксис defineDataView: pipeline, map, path, converters и правила безопасности.', icon: 'ti ti-transform', file: 'domain/DataView', category: DocsCategory.EndgeDomain },
      { id: 'domain-computation', title: 'Computation source', description: 'defineComputation graph, ValueExpression и sandboxed TypeScript nodes.', icon: 'ti ti-calculator', file: 'domain/Computation', category: DocsCategory.EndgeDomain },
      { id: 'domain-component', title: 'Component (Компонент)', description: 'Компонент отображения: таблица, DSL.', icon: 'ti ti-layout-grid', file: 'domain/Component', category: DocsCategory.EndgeDomain },
      { id: 'domain-parameter', title: 'Parameter (Параметр)', description: 'Параметр: идентификатор, тип, значения.', icon: 'ti ti-adjustments', file: 'domain/Parameter', category: DocsCategory.EndgeDomain },
      { id: 'domain-filter', title: 'Filter (Фильтр)', description: 'Фильтр данных: поля, условия, конвертеры.', icon: 'ti ti-filter', file: 'domain/Filter', category: DocsCategory.EndgeDomain },
      { id: 'domain-converter', title: 'Converter (Конвертер)', description: 'Преобразование значения из одного типа в другой.', icon: 'ti ti-arrow-left-right', file: 'domain/Converter', category: DocsCategory.EndgeDomain },
      { id: 'domain-integration', title: 'Integration (Интеграция)', description: 'Интеграция с внешней системой или API.', icon: 'ti ti-plug', file: 'domain/Integration', category: DocsCategory.EndgeDomain },
      { id: 'domain-folder', title: 'Folder (Папка)', description: 'Папка для группировки сущностей в дереве.', icon: 'ti ti-folder', file: 'domain/Folder', category: DocsCategory.EndgeDomain },
      { id: 'domain-version', title: 'Version (Версия)', description: 'Версия домена или снимок конфигурации.', icon: 'ti ti-versions', file: 'domain/Version', category: DocsCategory.EndgeDomain },
      { id: 'submodules-federation', title: 'Федерации и модули', description: 'Общая модель EndgeFederation/EndgeModule: lifecycle, persistence и порядок вызовов.', icon: 'ti ti-hierarchy-2', file: 'submodules/Federation', category: DocsCategory.EndgeSubModules },
      { id: 'submodules-endge-vue', title: 'EndgeVue plugin', description: 'Plugin @endge/vue: registrations render-компонентов и фаз Raph.', icon: 'ti ti-brand-vue', file: 'submodules/EndgeVue', category: DocsCategory.EndgeSubModules },
      { id: 'submodules-app-core', title: 'AppCore', description: 'Прикладная точка запуска: Endge.use(EndgeVuePlugin) и Endge.boot(ctx).', icon: 'ti ti-layers-linked', file: 'submodules/AppCore', category: DocsCategory.EndgeSubModules },
      { id: 'submodules-app-core-bootstrap', title: 'AppCore boot', description: 'Pipeline инициализации конфигуратора через Endge.boot(ctx).', icon: 'ti ti-route-2', file: 'submodules/AppCoreBootstrap', category: DocsCategory.EndgeSubModules },
      { id: 'submodules-app-core-integration', title: 'AppCore integrations', description: 'Связка Endge.use(EndgeVuePlugin) + Endge.boot(ctx).', icon: 'ti ti-link', file: 'submodules/AppCoreIntegration', category: DocsCategory.EndgeSubModules },
      { id: 'submodules-context', title: 'Endge.context', description: 'Текущий проект, среда и локаль runtime-контекста.', icon: 'ti ti-app-window', file: 'submodules/Context', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-diagnostics', title: 'Endge.diagnostics', description: 'Новый модуль системной диагностики и мониторинга ядра.', icon: 'ti ti-activity-heartbeat', file: 'core-modules/EndgeDiagnostics', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-debug', title: 'Endge.debug', description: 'Отладочная трассировка (спаны) операций.', icon: 'ti ti-bug', file: 'submodules/Debug', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-domain', title: 'Endge.domain', description: 'Хранилище reflect-сущностей и доменной конфигурации.', icon: 'ti ti-database', file: 'submodules/Domain', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-runtime-entities', title: 'Runtime-сущности', description: 'Живые runtime-host объекты и их отличие от domain entity.', icon: 'ti ti-box-multiple', file: 'submodules/RuntimeEntities', category: DocsCategory.EndgeSubModules },
      { id: 'submodules-vocabs', title: 'Endge.vocabs', description: 'Словари и справочники по namespace.', icon: 'ti ti-book', file: 'submodules/Vocabs', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-runtime', title: 'Endge.runtime', description: 'Жизнь runtime-host поверх Raph и исполнение фаз.', icon: 'ti ti-cpu', file: 'submodules/Runtime', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-vars', title: 'Endge.workspace.variables', description: 'Workspace variables и подстановка значений.', icon: 'ti ti-variable', file: 'submodules/Vars', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-query', title: 'Endge.runtime.query', description: 'Runtime API выполнения запросов.', icon: 'ti ti-database-search', file: 'submodules/Query', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-auth', title: 'Endge.auth', description: 'Аутентификация и токены.', icon: 'ti ti-lock', file: 'submodules/Auth', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-schema', title: 'Endge.schema', description: 'Схема и хранилище (Payload, документы).', icon: 'ti ti-schema', file: 'submodules/Schema', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-flow', title: 'Endge.runtime.flow', description: 'Исполнение action-flow через run/runBlock и runtime host.', icon: 'ti ti-bolt', file: 'submodules/Flow', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-updates', title: 'Endge.updates', description: 'Поток обновлений и синхронизация с сервером.', icon: 'ti ti-refresh', file: 'submodules/Updates', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-events', title: 'Endge.events', description: 'Runtime-шина: transport для подписки и эмита в коде.', icon: 'ti ti-broadcast', file: 'submodules/Events', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-sse', title: 'Endge.sse', description: 'Server-Sent Events: приём сообщений с сервера.', icon: 'ti ti-antenna', file: 'submodules/Sse', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-ui', title: 'Endge.ui', description: 'Утилиты и состояние UI.', icon: 'ti ti-devices', file: 'submodules/Ui', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-bind', title: 'Endge.bind', description: 'Программная подмена кода у converter/action/runtime step.', icon: 'ti ti-code-plus', file: 'submodules/Bind', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-console', title: 'Endge.console', description: 'Консоль разработчика: регистрация команд.', icon: 'ti ti-terminal', file: 'submodules/Console', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-runtime-debugger', title: 'Endge.runtimeDebugger', description: 'Отладка вкладок: канал и список вкладок.', icon: 'ti ti-brand-chrome', file: 'submodules/RuntimeDebugger', category: DocsCategory.EndgeCoreModules },
      { id: 'submodules-styles', title: 'Endge.styles', description: 'Source-first RStyle и boundary будущего EndgeCSS compiler/runtime.', icon: 'ti ti-brush', file: 'submodules/Styles', category: DocsCategory.EndgeCoreModules },
      { id: 'plugins-dsl-playground', title: 'DSL Source Playground', description: 'Редактор исторического JSX source без compile/runtime preview.', icon: 'ti ti-device-gamepad-3', file: 'Plugins_DSL_Playground', category: DocsCategory.Configuring },
      { id: 'widgets', title: 'Виджеты', description: 'Список виджетов IDE: Домен, Инспектор, Документация и др.', icon: 'ti ti-layout-sidebar', file: 'Widgets', category: DocsCategory.Configuring },
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
      id: EndgeIDEDocs.DOCS_TAB_ID,
      label: entry.title,
      viewId: DOCS_VIEW_ID,
      payload: { docId: entry.id, file: entry.file, title: entry.title },
      closable: true,
      meta: { icon: 'ti ti-file-text text-xl' },
    }
  }
}

export { DOCS_VIEW_ID }
