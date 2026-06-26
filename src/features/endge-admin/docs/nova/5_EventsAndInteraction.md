# События и интерактивность

NOVA умеет маршрутизировать DOM-события по интерактивным узлам сцены.

Поддерживаются:

- `click`, `dblclick`
- `mousedown`, `mouseup`, `mousemove`
- `mouseenter`, `mouseleave`
- `dragstart`, `dragmove`, `dragend`
- `wheel`, `zoom`
- `keydown`, `keyup`
- `contextmenu`

## Пример

```ts
node.interactive = true

node.on('click', (e) => {
  console.log('clicked', e.clientX, e.clientY)
})

node.on('dragmove', (_e, dx, dy) => {
  node.setPosition(node.x + dx, node.y + dy)
  node.dirty({ matrix: true, render: true })
})
```

## Как это работает

- `containsPoint()` делает hit-test с учетом матрицы;
- `NovaEvents` держит состояния hover/drag;
- события coalescing на `mousemove` идет через `requestAnimationFrame`.

## Рекомендации

- регистрируйте обработчики только на реально интерактивных узлах;
- после изменения геометрии не забывайте `dirty(...)`;
- для сложных drag-сценариев держите отдельный интерактивный layer.
