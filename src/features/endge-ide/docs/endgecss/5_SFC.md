# Endge SFC styles

Omitted `lang` and `lang="endgecss"` are accepted. Any explicit other language, including CSS, is an error. Scoped styles receive a stable scope id derived from component identity.

```html
<template>
  <Badge id="status" class="notice" state="delayed" part="status">Delayed</Badge>
</template>

<style scoped lang="endgecss">
  #status:state(delayed) { color: orange; }
  ::part(status) { font-weight: 700; }
</style>
```

`state` accepts a string, string array, or boolean record at runtime. `part` must be a static token list and publishes a visual surface. `[part="status"]` is local attribute matching; `::part(status)` may cross component encapsulation. `::slot()` is reserved and produces a diagnostic.

## Table surfaces

The built-in `Table` primitive publishes a renderer-neutral structural contract:

- `::part(grid)` — корневой grid и его общая поверхность;
- `::part(header)` — вся полоса шапки;
- `::part(header-cell)` — отдельная ячейка шапки;
- `::part(header-content)` — title, sort indicator и menu icons внутри заголовка;
- `::part(body)` — viewport строк;
- `::part(row)` — обычная строка;
- `::part(cell)` — физическая ячейка и ее grid borders;
- `::part(cell-content)` — пользовательский контент внутри ячейки;
- `::part(group-row)` — строка группировки.

These names do not expose RevoGrid DOM classes. Native DOM, Shadcn, or a future
Canvas adapter can publish the same semantic surfaces through their own materializer.

```html
<style scoped lang="endgecss">
  #groundhandling-control::part(header) {
    background-color: #1e3a5f;
  }

  #groundhandling-control::part(header-cell) {
    background-color: #1e3a5f;
    border-right: 1px solid #718096;
    border-bottom: 1px solid #718096;
  }

  #groundhandling-control::part(header-content) {
    color: #ffffff;
    font-weight: 600;
  }

  #groundhandling-control::part(cell-content) {
    color: #1f2937;
  }
</style>
```

`row` and `cell` are the right surfaces for background, borders, selection and
search highlighting. `cell-content` is the stable target for text because a DOM
grid implementation may set its own inherited color on the physical cell.

Полный source-first пример пяти Hub themes находится в
[`examples/hub-table-themes.endgecss`](./examples/hub-table-themes.endgecss).
