# Виды - отображение на странице

Вид связывает компонент (таблицу или DSL), запрос и фильтр. Чтобы показать вид в приложении, используйте композабл `useEndge.view()` из `@endge/vue` и компонент `EndgeComponent`.

## Пример

Подставьте вместо `'my-view-id'` идентификатор вашего вида (как в домене).

```vue
<script setup lang="ts">
import { EndgeComponent, useEndge } from '@endge/vue'
import { onMounted } from 'vue'
// import FilterGenerator from '@/features/@app/ui/sections/filter/FilterGenerator.vue'

const { comRt, refresh, filter } = useEndge.view('my-view-id')

onMounted(async () => {
  await refresh()
})
</script>

<template>
  <FilterGenerator v-if="filter" :filter="filter" space="default" />
  <EndgeComponent :runtime="comRt" enabled-status-bar />
</template>
```

## Что даёт композабл

| Свойство   | Описание |
|-----------|----------|
| `comRt`   | Runtime компонента (таблицы). Передаётся в `<EndgeComponent :runtime="comRt" />`. |
| `queryRt` | Runtime запроса (для отладки или подписки на обновления). |
| `refresh` | Функция перезапуска запроса вида (обновление данных). |
| `destroy` | Очистка рантаймов (вызывается автоматически при размонтировании). |
| `view`   | Доменная сущность вида (`RView` или `null`, если вид не найден). |
| `filter` | Доменная сущность фильтра вида (`RFilter` или `undefined`, если у вида нет `filterId`). Можно передать в `<FilterGenerator :filter="filter" />`. |
| `table`  | Доменная сущность компонента - таблица или DSL (`RComponent` или `null`). |
| `query`  | Доменная сущность запроса вида (`RQuery` или `null`). |

## Опции

Второй аргумент `useEndge.view(identity, options)`:

- **`space`** - пространство для запроса (фильтры и т.д.), по умолчанию `'default'`.

## Обновление данных

Вызовите `refresh()` при необходимости обновить данные (например, по кнопке «Обновить»):

```vue
<template>
  <Button @click="refresh">Обновить</Button>
  <EndgeComponent :runtime="comRt" />
</template>
```
