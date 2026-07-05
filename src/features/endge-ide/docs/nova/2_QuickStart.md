# Быстрый старт NOVA

Ниже минимальный сценарий: создать canvas, отрисовать простой примитив и обновлять кадр.

## 1) Установка зависимости

```bash
pnpm add @endge/nova
```

## 2) Базовая инициализация

```ts
import { NovaGraphics } from '@endge/nova'

const canvas = document.getElementById('my-canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')
const dpr = NovaGraphics.dpr()

const width = 640
const height = 360
canvas.width = width * dpr
canvas.height = height * dpr
canvas.style.width = `${width}px`
canvas.style.height = `${height}px`

if (ctx) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, width, height)

  ctx.fillStyle = '#ef4444'
  ctx.fillRect(40, 40, 140, 140)
}
```

## 3) Что дальше

После базовой проверки переходите к `NovaApp` + `NovaSurface` + `NovaNode`, чтобы:

- получить фазовый pipeline;
- рисовать не напрямую, а через рендерер;
- подключить события (`drag`, `click`, `wheel`) и hit-test.
