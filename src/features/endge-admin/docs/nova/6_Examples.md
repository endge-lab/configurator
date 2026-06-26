# Практический пример: красный квадрат

Этот сценарий полезен как smoke-test интеграции NOVA в виджет/вкладку.

## Цель

- проверить, что пакет подключен;
- проверить, что canvas корректно масштабируется под `DPR`;
- получить первый визуальный результат.

## Пример кода

```ts
import { NovaGraphics } from '@endge/nova'

function draw(canvas: HTMLCanvasElement): void {
  const dpr = NovaGraphics.dpr()
  const width = canvas.parentElement?.clientWidth ?? 640
  const height = canvas.parentElement?.clientHeight ?? 360
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, width, height)

  ctx.fillStyle = '#ef4444'
  ctx.fillRect(40, 40, 140, 140)
}
```

## Расширение примера

1. Добавить второй квадрат с alpha.
2. Подключить drag для перемещения.
3. Вынести координаты в store и обновлять по данным из `@endge/raph`.
4. Перейти с прямого `ctx` на `NovaApp`/`NovaSurface`/`NovaNode`.
