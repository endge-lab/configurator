# Presentation Facets и Renderer Bindings

Эта заметка описывает, как можно сделать универсальный механизм подключения визуализации к сущностям, не смешивая это с их runtime-логикой.

---

## Проблема

Сейчас `Endge.render` уже хранит registry render-компонентов, но архитектурно важно сделать ещё один шаг:

- не просто хранить renderers;
- а уметь **назначать** их сущностям и их визуальным ролям;
- причём одинаково для `page`, `project`, `filter`, `component` и других сущностей.

Именно здесь нужен явный `Presentation Facet`.

---

## Основная идея

Надо разделить три вещи:

1. `Renderer Registry`
2. `Presentation Contract`
3. `Presentation Binding`

### Renderer Registry

Хранит кодовые реализации renderers.

Пример:

- `page.default`
- `project.shell`
- `filter.control.default`
- `component.table.compact`

Registry знает, как получить Vue-компонент или функциональный renderer по ключу.

### Presentation Contract

Говорит, какие **визуальные роли** вообще поддерживает сущность.

Например:

- `page` поддерживает `main`, `header`, `empty`, `error`
- `project` поддерживает `shell`
- `filter` поддерживает `control`
- `component` поддерживает `body`

Контракт нужен, чтобы:

- не назначать что угодно на что угодно;
- валидировать конфигурацию;
- давать правильный выбор в UI-конфигураторе.

### Presentation Binding

Хранит правило назначения renderer.

Например:

- для `project A` у роли `page.main` использовать `page.schedule.compact`
- для `filter X` у роли `control` использовать `filter.select.rich`

То есть binding связывает:

- сущность или контекст;
- presentation role;
- renderer ref;
- правила override.

---

## Почему это должно быть похоже на behavior bindings

Самая сильная версия архитектуры здесь - не изобретать отдельную логику, а повторить уже знакомый паттерн:

- для behavior есть `contracts + bindings + resolver`
- для presentation должно быть `presentation contracts + presentation bindings + resolver`

Тогда система становится симметричной:

- `Behavior Resolver` собирает итоговую поведенческую реакцию;
- `Presentation Resolver` собирает итоговую визуализацию.

Это уменьшает количество специальных правил в ядре.

---

## Как это работает на практике

Пример чтения:

1. пользователь монтирует `EndgePage page="schedule"`;
2. компонент поднимает runtime страницы;
3. runtime живёт независимо от UI;
4. presentation resolver ищет роль `page.main`;
5. если binding найден, он резолвит renderer;
6. renderer подключается и начинает визуализацию;
7. если renderer не найден, page остаётся headless, но runtime всё равно работает.

Такой же подход можно использовать для:

- `EndgeProject`
- `EndgeFilter`
- `EndgeView`
- `EndgeComponentHost`

---

## Что именно стоит хранить в домене

В домене лучше хранить не сами Vue-компоненты, а только конфигурацию ссылки на них.

То есть:

- да: `rendererRef = "page.default"`
- нет: сам Vue SFC внутри reflect-сущности

Это позволяет:

- не смешивать домен и framework;
- не делать доменные документы зависящими от Vue;
- легче переопределять визуал по environment и scope.

---

## Рекомендуемая модель

Для presentation binding полезны поля, похожие на обычные bindings:

- `ownerType`
- `ownerId`
- `targetType`
- `targetId`
- `role`
- `rendererRef`
- `mode`
- `priority`
- `environmentId`

Тогда presentation override можно читать так же, как behavior override:

- `replace`
- `append`
- `prepend`
- `disable`

Хотя для visual resolver чаще всего главным режимом будет именно `replace`.

---

## Практическое правило

Если сущность должна жить без UI, но при этом иметь подключаемую визуализацию, ей нужен presentation facet.

Если одну и ту же сущность надо по-разному отображать в разных tenant/project/page контекстах, ей нужен presentation binding resolver.
