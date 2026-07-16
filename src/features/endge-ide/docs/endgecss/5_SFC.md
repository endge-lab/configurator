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

The built-in `Table` primitive publishes two header surfaces:

- `::part(header)` — вся область заголовка каждой колонки;
- `::part(header-content)` — контейнер текста и sort/menu icons.

```html
<style scoped lang="endgecss">
  #groundhandling-control::part(header) {
    background-color: #1e3a5f;
  }

  #groundhandling-control::part(header-content) {
    color: #ffffff;
    font-weight: 600;
  }
</style>
```
