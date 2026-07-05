# Рендеринг 2D в NOVA

В 2D рендерере вы работаете через схему примитивов (`NovaSchema`).

## Основные примитивы

- `rect`
- `border`
- `line`
- `circle`
- `polygon`
- `text`
- `icon`

Пример схемы:

```ts
renderer.schema([
  {
    type: 'rect',
    x: 20,
    y: 20,
    width: 180,
    height: 80,
    styles: {
      background: '#111827',
      border: { color: '#374151', width: 1, radius: 8 },
    },
  },
  {
    type: 'text',
    text: 'NOVA',
    x: 20,
    y: 20,
    width: 180,
    height: 80,
    styles: {
      color: '#f9fafb',
      align: { horizontal: 'center', vertical: 'middle' },
      font: { family: 'Inter', size: 14, weight: '600' },
    },
  },
])
```

## Что полезно помнить

- учитывайте `DPR` для чёткости;
- для текста используйте `measureText` при расчёте layout;
- при сложной сцене делите отрисовку на несколько `surface`;
- минимизируйте полный `clear` всей сцены без необходимости.
