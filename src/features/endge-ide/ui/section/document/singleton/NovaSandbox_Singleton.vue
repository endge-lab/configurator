<script setup lang="ts">
import { ComponentType, Endge, RComponentDSL } from '@endge/core'
import { ComponentType_DSL_Canvas, NovaGraphics, createNovaTableSchemaFromModel } from '@endge/nova'
import type { NovaSchema, NovaTableModel } from '@endge/nova'
import { useLocalStorage } from '@vueuse/core'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatJsx } from '@/features/endge-ide/tools/format-jsx'
import ScriptEditor from '@/features/endge-ide/ui/components/ScriptEditor.vue'

const squareCanvasRef = ref<HTMLCanvasElement | null>(null)
const jsxCanvasRef = ref<HTMLCanvasElement | null>(null)
const gsonCanvasRef = ref<HTMLCanvasElement | null>(null)
const tableCanvasRef = ref<HTMLCanvasElement | null>(null)
const tableViewportRef = ref<HTMLDivElement | null>(null)
const sceneWidth = ref(640)
const sceneHeight = ref(360)

const squareX = ref(40)
const squareY = ref(40)
const squareSize = 140

const isDragging = ref(false)
const dragOffsetX = ref(0)
const dragOffsetY = ref(0)
const jsxModel = ref<RComponentDSL | null>(null)
const jsxError = ref('')
const gsonError = ref('')
const gsonSchema = ref<NovaSchema>([])
const tableError = ref('')
const tableSchema = ref<NovaSchema>([])
const tableContentWidth = ref(960)
const tableContentHeight = ref(520)
const activeTab = ref('square')

const jsxScript = useLocalStorage('nova-playground-jsx-editor', `<Layout direction="column" gap="10" p="16" bg="#F8FAFC">
  <Box bg="#E2E8F0" p="12" borderWidth="1" borderColor="#CBD5E1">
    <Text size="18" color="#0F172A">{{ $.title }}</Text>
    <Text size="13" color="#334155">{{ $.subtitle }}</Text>
  </Box>
  <Box bg="#FEE2E2" p="12">
    <Text size="14" color="#991B1B">Значение: {{ $.value }}</Text>
  </Box>
</Layout>
`)
const selectedDemoId = ref<string>('')
const selectedGsonDemoId = ref<string>('')
const selectedTableDemoId = ref<string>('')

const isTablePanning = ref(false)
const tablePanStartX = ref(0)
const tablePanStartY = ref(0)
const tablePanStartScrollLeft = ref(0)
const tablePanStartScrollTop = ref(0)

/** Примеры синхронизированы с DSL Playground. */
const DSL_DEMO_OPTIONS: { id: string; label: string; jsx: string }[] = [
  { id: 'text', label: 'Text', jsx: '<Text bold color="#d32f2f" size="16">Привет, мир</Text>' },
  { id: 'box', label: 'Box', jsx: '<Box p="2" bg="#f0f0f0">\n  <Text>Box с отступами и фоном</Text>\n</Box>' },
  { id: 'flex', label: 'Flex (row)', jsx: '<Flex row>\n  <Text>Первый</Text>\n  <Text>Второй</Text>\n</Flex>' },
  { id: 'flex-col', label: 'Flex (col)', jsx: '<Flex col gap="2">\n  <Text>Сверху</Text>\n  <Text>Снизу</Text>\n</Flex>' },
  { id: 'layout', label: 'Layout', jsx: '<Layout direction="row" gap="1rem" align="center">\n  <Text>Слева</Text>\n  <Text>Справа</Text>\n</Layout>' },
  { id: 'if-else', label: 'If / Else', jsx: '<Text if="{ true }">Показано (if=true)</Text>\n<Text else>Скрыто (else)</Text>' },
  { id: 'datetime', label: 'DateTime', jsx: '<DateTime value="2024-10-01T12:00:00Z" format="dd.MM.yyyy HH:mm" timezone="Europe/Moscow" />' },
  { id: 'tooltip', label: 'Tooltip', jsx: '<Text tooltip:text="Подсказка при наведении">Наведи на меня</Text>' },
  { id: 'styles', label: 'Стили (p, b, r)', jsx: '<Box p="2" b="1 #ddd" r="8">\n  <Text>Отступы, рамка, скругление</Text>\n</Box>' },
]

const gsonScript = useLocalStorage('nova-playground-gson-editor', `[
  {
    "type": "rect",
    "x": 24,
    "y": 24,
    "width": 140,
    "height": 140,
    "styles": {
      "background": "#ef4444"
    }
  }
]`)

const tableScript = useLocalStorage('nova-playground-table-editor', `{
  "bounds": { "x": 16, "y": 16, "width": 720, "height": 380 },
  "showRowIndex": true,
  "headerHeight": 38,
  "rowHeight": 34,
  "palette": {
    "headerBg": "#E2E8F0",
    "headerText": "#0F172A",
    "rowBg": "#FFFFFF",
    "rowAltBg": "#F8FAFC",
    "rowText": "#0F172A",
    "border": "#CBD5E1"
  },
  "columns": [
    { "key": "task", "title": "Задача", "width": 300, "align": "left" },
    { "key": "owner", "title": "Ответственный", "width": 180, "align": "left" },
    { "key": "status", "title": "Статус", "width": 120, "align": "center" },
    { "key": "progress", "title": "Прогресс, %", "width": 120, "align": "right" }
  ],
  "rows": [
    { "task": "Проектирование Table API", "owner": "Анна", "status": "done", "progress": 100 },
    { "task": "Виртуализация строк", "owner": "Иван", "status": "in progress", "progress": 65 },
    { "task": "Поддержка drag колонок", "owner": "Мария", "status": "todo", "progress": 0 },
    { "task": "Редактор ячеек", "owner": "Олег", "status": "todo", "progress": 0 },
    { "task": "Профилирование FPS", "owner": "Николай", "status": "in progress", "progress": 45 },
    { "task": "Снапшоты состояния", "owner": "Елена", "status": "done", "progress": 100 },
    { "task": "Тесты рендера", "owner": "Сергей", "status": "in progress", "progress": 70 },
    { "task": "Документация", "owner": "Юлия", "status": "todo", "progress": 10 }
  ]
}`)

/** Примеры JSON-схем по примитивам NOVA. */
const GSON_DEMO_OPTIONS: { id: string; label: string; gson: string }[] = [
  {
    id: 'rect',
    label: 'Rect (красный квадрат)',
    gson: `[
  {
    "type": "rect",
    "x": 24,
    "y": 24,
    "width": 140,
    "height": 140,
    "styles": {
      "background": "#ef4444",
      "border": { "color": "#991b1b", "width": 2, "radius": 8 }
    }
  }
]`,
  },
  {
    id: 'text',
    label: 'Text',
    gson: `[
  {
    "type": "text",
    "text": "Привет из JSON",
    "x": 24,
    "y": 24,
    "width": 280,
    "height": 40,
    "styles": {
      "color": "#0f172a",
      "font": { "family": "Inter", "size": 18, "weight": "600" }
    }
  }
]`,
  },
  {
    id: 'line',
    label: 'Line',
    gson: `[
  {
    "type": "line",
    "x1": 24,
    "y1": 40,
    "x2": 320,
    "y2": 140,
    "styles": { "color": "#2563eb", "width": 3 }
  }
]`,
  },
  {
    id: 'circle',
    label: 'Circle',
    gson: `[
  {
    "type": "circle",
    "x": 120,
    "y": 90,
    "radius": 60,
    "styles": {
      "background": "#22c55e",
      "border": { "color": "#166534", "width": 3 }
    }
  }
]`,
  },
  {
    id: 'border',
    label: 'Border',
    gson: `[
  {
    "type": "border",
    "x": 24,
    "y": 24,
    "width": 260,
    "height": 140,
    "position": "all",
    "styles": { "color": "#7c3aed", "width": 4 }
  }
]`,
  },
  {
    id: 'polygon',
    label: 'Polygon',
    gson: `[
  {
    "type": "polygon",
    "points": [
      { "x": 80, "y": 24 },
      { "x": 180, "y": 160 },
      { "x": 24, "y": 160 }
    ],
    "styles": {
      "background": "#f59e0b",
      "stroke": "#92400e",
      "lineWidth": 3
    }
  }
]`,
  },
  {
    id: 'icon',
    label: 'Icon (fallback demo)',
    gson: `[
  {
    "type": "icon",
    "x": 24,
    "y": 24,
    "width": 80,
    "height": 80,
    "icon": "missing-icon"
  }
]`,
  },
  {
    id: 'all',
    label: 'Все примитивы',
    gson: `[
  {
    "type": "rect",
    "x": 16,
    "y": 16,
    "width": 340,
    "height": 190,
    "styles": { "background": "#f8fafc", "border": { "color": "#cbd5e1", "width": 1, "radius": 10 } }
  },
  {
    "type": "text",
    "text": "NOVA primitives",
    "x": 28,
    "y": 28,
    "width": 180,
    "height": 24,
    "styles": { "color": "#0f172a", "font": { "size": 16, "weight": "700" } }
  },
  {
    "type": "line",
    "x1": 28,
    "y1": 64,
    "x2": 210,
    "y2": 64,
    "styles": { "color": "#2563eb", "width": 2 }
  },
  {
    "type": "circle",
    "x": 70,
    "y": 130,
    "radius": 28,
    "styles": { "background": "#22c55e", "border": { "color": "#166534", "width": 2 } }
  },
  {
    "type": "polygon",
    "points": [
      { "x": 150, "y": 100 },
      { "x": 200, "y": 165 },
      { "x": 110, "y": 165 }
    ],
    "styles": { "background": "#f59e0b", "stroke": "#92400e", "lineWidth": 2 }
  },
  {
    "type": "border",
    "x": 250,
    "y": 96,
    "width": 92,
    "height": 70,
    "position": "all",
    "styles": { "color": "#7c3aed", "width": 3 }
  },
  {
    "type": "icon",
    "x": 250,
    "y": 28,
    "width": 40,
    "height": 40,
    "icon": "missing-icon"
  }
]`,
  },
]

/** Примеры Table-конфига для демо будущего Reva Grid API. */
const TABLE_DEMO_OPTIONS: { id: string; label: string; json: string }[] = [
  {
    id: 'basic',
    label: 'Базовая таблица задач',
    json: `{
  "bounds": { "x": 16, "y": 16, "width": 720, "height": 380 },
  "showRowIndex": true,
  "headerHeight": 38,
  "rowHeight": 34,
  "columns": [
    { "key": "task", "title": "Задача", "width": 300, "align": "left" },
    { "key": "owner", "title": "Ответственный", "width": 180, "align": "left" },
    { "key": "status", "title": "Статус", "width": 120, "align": "center" },
    { "key": "progress", "title": "Прогресс, %", "width": 120, "align": "right" }
  ],
  "rows": [
    { "task": "Проектирование Table API", "owner": "Анна", "status": "done", "progress": 100 },
    { "task": "Виртуализация строк", "owner": "Иван", "status": "in progress", "progress": 65 },
    { "task": "Поддержка drag колонок", "owner": "Мария", "status": "todo", "progress": 0 },
    { "task": "Редактор ячеек", "owner": "Олег", "status": "todo", "progress": 0 },
    { "task": "Профилирование FPS", "owner": "Николай", "status": "in progress", "progress": 45 },
    { "task": "Снапшоты состояния", "owner": "Елена", "status": "done", "progress": 100 }
  ]
}`,
  },
  {
    id: 'finance',
    label: 'Финансы',
    json: `{
  "bounds": { "x": 16, "y": 16, "width": 760, "height": 380 },
  "showRowIndex": true,
  "headerHeight": 40,
  "rowHeight": 36,
  "palette": {
    "headerBg": "#DBEAFE",
    "headerText": "#1E3A8A",
    "rowBg": "#FFFFFF",
    "rowAltBg": "#EFF6FF",
    "rowText": "#111827",
    "border": "#93C5FD"
  },
  "columns": [
    { "key": "month", "title": "Месяц", "width": 180, "align": "left" },
    { "key": "revenue", "title": "Выручка", "width": 170, "align": "right" },
    { "key": "cost", "title": "Расходы", "width": 170, "align": "right" },
    { "key": "profit", "title": "Прибыль", "width": 170, "align": "right" }
  ],
  "rows": [
    { "month": "Январь", "revenue": "1 250 000", "cost": "830 000", "profit": "420 000" },
    { "month": "Февраль", "revenue": "1 340 000", "cost": "870 000", "profit": "470 000" },
    { "month": "Март", "revenue": "1 410 000", "cost": "900 000", "profit": "510 000" },
    { "month": "Апрель", "revenue": "1 580 000", "cost": "960 000", "profit": "620 000" },
    { "month": "Май", "revenue": "1 720 000", "cost": "1 020 000", "profit": "700 000" },
    { "month": "Июнь", "revenue": "1 840 000", "cost": "1 090 000", "profit": "750 000" },
    { "month": "Июль", "revenue": "1 920 000", "cost": "1 110 000", "profit": "810 000" }
  ]
}`,
  },
  {
    id: 'auto-width',
    label: 'Авто-ширина колонок',
    json: `{
  "bounds": { "x": 16, "y": 16, "width": 760, "height": 380 },
  "showRowIndex": false,
  "columns": [
    { "key": "id", "title": "ID" },
    { "key": "name", "title": "Имя" },
    { "key": "email", "title": "Email" },
    { "key": "role", "title": "Роль", "align": "center" }
  ],
  "rows": [
    { "id": "u-001", "name": "Ирина", "email": "irina@example.com", "role": "admin" },
    { "id": "u-002", "name": "Максим", "email": "maksim@example.com", "role": "editor" },
    { "id": "u-003", "name": "Алексей", "email": "alex@example.com", "role": "viewer" },
    { "id": "u-004", "name": "Наталья", "email": "natasha@example.com", "role": "editor" },
    { "id": "u-005", "name": "Павел", "email": "pavel@example.com", "role": "viewer" },
    { "id": "u-006", "name": "Марина", "email": "marina@example.com", "role": "admin" }
  ]
}`,
  },
]

function update(): void {
  requestAnimationFrame(() => {
    drawSquareCanvas()
    drawJSXCanvas()
    drawGSONCanvas()
    drawTableCanvas()
  })
}

function drawSquareCanvas(): void {
  const canvas = squareCanvasRef.value
  if (!canvas)
    return

  const parent = canvas.parentElement
  const width = parent?.clientWidth ?? 640
  const height = parent?.clientHeight ?? 360
  sceneWidth.value = width
  sceneHeight.value = height
  const dpr = NovaGraphics.dpr()
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return

  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, width, height)

  ctx.fillStyle = '#ef4444'
  ctx.fillRect(squareX.value, squareY.value, squareSize, squareSize)
}

function setupCanvas2D(
  canvas: HTMLCanvasElement,
): { width: number; height: number; ctx: CanvasRenderingContext2D } | null {
  const parent = canvas.parentElement
  const width = parent?.clientWidth ?? 640
  const height = parent?.clientHeight ?? 360
  const dpr = NovaGraphics.dpr()
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return null

  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, width, height)

  return { width, height, ctx }
}

function drawJSXCanvas(): void {
  const canvas = jsxCanvasRef.value
  if (!canvas)
    return

  const prepared = setupCanvas2D(canvas)
  if (!prepared)
    return
  const { width, height, ctx } = prepared

  if (!jsxModel.value) {
    if (jsxError.value) {
      ctx.fillStyle = '#b91c1c'
      ctx.font = '12px monospace'
      ctx.textBaseline = 'top'
      ctx.fillText(jsxError.value, 12, 12)
    }
    return
  }

  const scope = Endge.script.getScope('nova-playground-jsx')
  const schema = ComponentType_DSL_Canvas({
    model: jsxModel.value,
    scope,
    comData: {
      title: 'Canvas JSX',
      subtitle: 'Рендер через @endge/nova',
      value: 128,
    },
    bounds: {
      x: 12,
      y: 12,
      width: width - 24,
      height: height - 24,
    },
  })

  drawSchemaOnCanvas(ctx, schema)
}

function drawGSONCanvas(): void {
  const canvas = gsonCanvasRef.value
  if (!canvas)
    return
  const prepared = setupCanvas2D(canvas)
  if (!prepared)
    return
  const { ctx } = prepared

  if (gsonError.value) {
    ctx.fillStyle = '#b91c1c'
    ctx.font = '12px monospace'
    ctx.textBaseline = 'top'
    ctx.fillText(gsonError.value, 12, 12)
    return
  }

  drawSchemaOnCanvas(ctx, gsonSchema.value)
}

function drawTableCanvas(): void {
  const canvas = tableCanvasRef.value
  if (!canvas)
    return
  const viewport = tableViewportRef.value
  const dpr = NovaGraphics.dpr()
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return

  const viewportWidth = viewport?.clientWidth ?? 640
  const viewportHeight = viewport?.clientHeight ?? 360
  const contentWidth = Math.max(tableContentWidth.value, viewportWidth)
  const contentHeight = Math.max(tableContentHeight.value, viewportHeight)

  canvas.width = Math.floor(contentWidth * dpr)
  canvas.height = Math.floor(contentHeight * dpr)
  canvas.style.width = `${contentWidth}px`
  canvas.style.height = `${contentHeight}px`

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, contentWidth, contentHeight)

  if (tableError.value) {
    ctx.fillStyle = '#b91c1c'
    ctx.font = '12px monospace'
    ctx.textBaseline = 'top'
    ctx.fillText(tableError.value, 12, 12)
    return
  }

  drawSchemaOnCanvas(ctx, tableSchema.value)
}

function drawSchemaOnCanvas(ctx: CanvasRenderingContext2D, schema: NovaSchema): void {
  for (const item of schema) {
    if (item.type === 'rect') {
      if (item.styles?.background) {
        ctx.fillStyle = String(item.styles.background)
        ctx.fillRect(item.x, item.y, item.width, item.height)
      }
      if (item.styles?.border?.width) {
        ctx.strokeStyle = item.styles.border.color || '#111827'
        ctx.lineWidth = item.styles.border.width
        ctx.strokeRect(item.x, item.y, item.width, item.height)
      }
      continue
    }

    if (item.type === 'border') {
      const color = item.styles?.color || '#111827'
      const w = item.styles?.width || 1
      ctx.fillStyle = color
      const sides = new Set<string>()
      if (!item.position || item.position === 'all') {
        sides.add('top')
        sides.add('right')
        sides.add('bottom')
        sides.add('left')
      } else if (item.position === 'vertical') {
        sides.add('left')
        sides.add('right')
      } else if (item.position === 'horizontal') {
        sides.add('top')
        sides.add('bottom')
      } else if (Array.isArray(item.position)) {
        item.position.forEach(s => sides.add(s))
      }
      if (sides.has('top')) ctx.fillRect(item.x, item.y, item.width, w)
      if (sides.has('right')) ctx.fillRect(item.x + item.width - w, item.y, w, item.height)
      if (sides.has('bottom')) ctx.fillRect(item.x, item.y + item.height - w, item.width, w)
      if (sides.has('left')) ctx.fillRect(item.x, item.y, w, item.height)
      continue
    }

    if (item.type === 'line') {
      ctx.beginPath()
      ctx.strokeStyle = item.styles?.color || '#111827'
      ctx.lineWidth = item.styles?.width || 1
      ctx.moveTo(item.x1, item.y1)
      ctx.lineTo(item.x2, item.y2)
      ctx.stroke()
      continue
    }

    if (item.type === 'circle') {
      ctx.beginPath()
      ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2)
      if (item.styles?.background) {
        ctx.fillStyle = String(item.styles.background)
        ctx.fill()
      }
      if (item.styles?.border?.width) {
        ctx.strokeStyle = item.styles.border.color || '#111827'
        ctx.lineWidth = item.styles.border.width
        ctx.stroke()
      }
      continue
    }

    if (item.type === 'polygon') {
      if (!item.points.length)
        continue
      ctx.beginPath()
      ctx.moveTo(item.points[0].x, item.points[0].y)
      for (let i = 1; i < item.points.length; i++) {
        ctx.lineTo(item.points[i].x, item.points[i].y)
      }
      ctx.closePath()
      if (item.styles?.background) {
        ctx.fillStyle = item.styles.background
        ctx.fill()
      }
      if (item.styles?.stroke) {
        ctx.strokeStyle = item.styles.stroke
        ctx.lineWidth = item.styles.lineWidth ?? 1
        ctx.stroke()
      }
      continue
    }

    if (item.type === 'icon') {
      let iconObject: any = item.icon
      if (typeof item.icon === 'string') {
        iconObject = NovaGraphics.getAsset(item.icon)
      }
      if (iconObject) {
        ctx.drawImage(iconObject, item.x, item.y, item.width, item.height)
      } else {
        ctx.fillStyle = '#f3f4f6'
        ctx.fillRect(item.x, item.y, item.width, item.height)
        ctx.strokeStyle = '#9ca3af'
        ctx.strokeRect(item.x, item.y, item.width, item.height)
        ctx.fillStyle = '#6b7280'
        ctx.font = '10px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('icon?', item.x + item.width / 2, item.y + item.height / 2)
      }
      continue
    }

    if (item.type === 'text') {
      const fontSize = item.styles?.font?.size ?? 14
      const fontFamily = item.styles?.font?.family ?? 'Inter'
      const fontWeight = item.styles?.font?.weight ?? 'normal'

      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
      ctx.fillStyle = item.styles?.color || '#111827'

      const align = item.styles?.align?.horizontal ?? 'left'
      if (align === 'center') {
        ctx.textAlign = 'center'
      } else if (align === 'right') {
        ctx.textAlign = 'right'
      } else {
        ctx.textAlign = 'left'
      }

      const valign = item.styles?.align?.vertical ?? 'top'
      if (valign === 'middle') {
        ctx.textBaseline = 'middle'
      } else if (valign === 'bottom') {
        ctx.textBaseline = 'bottom'
      } else {
        ctx.textBaseline = 'top'
      }

      let textX = item.x
      let textY = item.y
      if (ctx.textAlign === 'center')
        textX = item.x + item.width / 2
      if (ctx.textAlign === 'right')
        textX = item.x + item.width
      if (ctx.textBaseline === 'middle')
        textY = item.y + item.height / 2
      if (ctx.textBaseline === 'bottom')
        textY = item.y + item.height

      ctx.fillText(item.text, textX, textY)
    }
  }
}

function compileJSXModel(): void {
  try {
    const model = new RComponentDSL()
    model.id = 'nova-jsx-playground'
    model.name = 'nova-jsx-playground'
    model.type = ComponentType.DSL
    model.jsxScript = jsxScript.value
    model.compile()
    jsxModel.value = model
    jsxError.value = ''
  } catch (e) {
    jsxModel.value = null
    jsxError.value = `Ошибка JSX: ${String(e)}`
  }
  update()
}

function onJSXInput(value: string): void {
  jsxScript.value = value
  compileJSXModel()
}

function normalizeSchemaValue(input: any): NovaSchema {
  if (Array.isArray(input)) {
    return input as NovaSchema
  }
  if (input && typeof input === 'object') {
    return [input as any]
  }
  return []
}

function compileGSONSchema(): void {
  try {
    const parsed = JSON.parse(gsonScript.value)
    gsonSchema.value = normalizeSchemaValue(parsed)
    gsonError.value = ''
  } catch (e) {
    gsonSchema.value = []
    gsonError.value = `Ошибка JSON: ${String(e)}`
  }
  update()
}

function onGSONInput(value: string): void {
  gsonScript.value = value
  compileGSONSchema()
}

function compileTableSchema(): void {
  try {
    const model = JSON.parse(tableScript.value) as NovaTableModel
    tableContentWidth.value = Math.max(960, model.bounds.x + model.bounds.width + 24)
    tableContentHeight.value = Math.max(520, model.bounds.y + model.bounds.height + 24)
    tableSchema.value = createNovaTableSchemaFromModel(model)
    tableError.value = ''
  } catch (e) {
    tableSchema.value = []
    tableError.value = `Ошибка Table JSON: ${String(e)}`
  }
  update()
}

function onTableInput(value: string): void {
  tableScript.value = value
  compileTableSchema()
}

function onTableCanvasMouseDown(event: MouseEvent): void {
  if (event.button !== 0)
    return
  const viewport = tableViewportRef.value
  if (!viewport)
    return

  isTablePanning.value = true
  tablePanStartX.value = event.clientX
  tablePanStartY.value = event.clientY
  tablePanStartScrollLeft.value = viewport.scrollLeft
  tablePanStartScrollTop.value = viewport.scrollTop
  event.preventDefault()
}

async function insertDemo(): Promise<void> {
  const opt = DSL_DEMO_OPTIONS.find(o => o.id === selectedDemoId.value)
  if (!opt)
    return
  jsxScript.value = await formatJsx(opt.jsx)
  compileJSXModel()
}

async function insertGSONDemo(): Promise<void> {
  const opt = GSON_DEMO_OPTIONS.find(o => o.id === selectedGsonDemoId.value)
  if (!opt)
    return
  gsonScript.value = opt.gson
  compileGSONSchema()
}

async function insertTableDemo(): Promise<void> {
  const opt = TABLE_DEMO_OPTIONS.find(o => o.id === selectedTableDemoId.value)
  if (!opt)
    return
  tableScript.value = opt.json
  compileTableSchema()
}

function handleResize(): void {
  update()
}

function getCanvasPoint(event: MouseEvent): { x: number; y: number } {
  const canvas = squareCanvasRef.value
  if (!canvas)
    return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function isPointInsideSquare(x: number, y: number): boolean {
  return (
    x >= squareX.value
    && x <= squareX.value + squareSize
    && y >= squareY.value
    && y <= squareY.value + squareSize
  )
}

function onCanvasMouseDown(event: MouseEvent): void {
  const p = getCanvasPoint(event)
  if (!isPointInsideSquare(p.x, p.y))
    return

  isDragging.value = true
  dragOffsetX.value = p.x - squareX.value
  dragOffsetY.value = p.y - squareY.value
}

function onWindowMouseMove(event: MouseEvent): void {
  if (isTablePanning.value) {
    const viewport = tableViewportRef.value
    if (!viewport)
      return
    const dx = event.clientX - tablePanStartX.value
    const dy = event.clientY - tablePanStartY.value
    viewport.scrollLeft = tablePanStartScrollLeft.value - dx
    viewport.scrollTop = tablePanStartScrollTop.value - dy
    return
  }

  if (!isDragging.value)
    return

  const p = getCanvasPoint(event)
  const maxX = sceneWidth.value - squareSize
  const maxY = sceneHeight.value - squareSize

  squareX.value = Math.min(Math.max(0, p.x - dragOffsetX.value), maxX)
  squareY.value = Math.min(Math.max(0, p.y - dragOffsetY.value), maxY)

  update()
}

function onWindowMouseUp(): void {
  isDragging.value = false
  isTablePanning.value = false
}

watch(activeTab, async () => {
  await nextTick()
  update()
})

onMounted(() => {
  Endge.script.declareJSX()
  compileJSXModel()
  compileGSONSchema()
  compileTableSchema()
  update()
  window.addEventListener('resize', handleResize)
  window.addEventListener('mousemove', onWindowMouseMove)
  window.addEventListener('mouseup', onWindowMouseUp)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
})
</script>

<template>
  <div class="w-full h-full p-4">
    <div class="w-full h-full rounded-lg border bg-card p-4 flex flex-col gap-3">
      <div class="text-sm font-semibold">
        Nova: тестовая песочница
      </div>
      <div class="text-xs text-muted-foreground">
        Режимы: drag-квадрат, JSX, JSON и Table.
      </div>
      <Tabs v-model="activeTab" class="flex-1 min-h-0 flex flex-col">
        <TabsList class="grid grid-cols-4 w-full max-w-[680px]">
          <TabsTrigger value="square">
            Квадрат
          </TabsTrigger>
          <TabsTrigger value="jsx">
            JSX Render
          </TabsTrigger>
          <TabsTrigger value="gson">
            JSON
          </TabsTrigger>
          <TabsTrigger value="table">
            Table
          </TabsTrigger>
        </TabsList>

        <TabsContent value="square" class="flex-1 min-h-0 mt-3 data-[state=inactive]:hidden">
          <div class="h-full rounded-md border bg-white min-h-0 flex flex-col">
            <div class="flex-1 min-h-0 p-3">
              <canvas
                ref="squareCanvasRef"
                class="block w-full h-full rounded-md border cursor-grab active:cursor-grabbing"
                @mousedown="onCanvasMouseDown"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="jsx" class="flex-1 min-h-0 mt-3 data-[state=inactive]:hidden">
          <div class="h-full rounded-md border bg-white min-h-0 flex flex-col">
            <div class="p-3 border-b flex items-center gap-2 flex-wrap">
              <Select v-model="selectedDemoId">
                <SelectTrigger class="w-[240px] h-9">
                  <SelectValue placeholder="Выберите пример JSX" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in DSL_DEMO_OPTIONS"
                    :key="opt.id"
                    :value="opt.id"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                class="h-9 w-9"
                :disabled="!selectedDemoId"
                title="Подставить пример в редактор"
                @click="insertDemo"
              >
                <i class="ti ti-file-import text-lg" />
              </Button>
            </div>

            <div class="p-3 pt-2 text-[11px] text-muted-foreground" v-if="jsxError">
              {{ jsxError }}
            </div>
            <div class="min-h-0 flex-1 border-t flex">
              <div class="w-1/2 min-w-0 p-3 border-r">
                <Label class="font-semibold mb-2 block">JSX редактор</Label>
                <ScriptEditor
                  :model-value="jsxScript"
                  class="h-[calc(100%-28px)] min-h-0"
                  @update:model-value="onJSXInput"
                />
              </div>
              <div class="w-1/2 min-w-0 p-3">
                <Label class="font-semibold mb-2 block">Canvas предпросмотр</Label>
                <div class="h-[calc(100%-28px)] min-h-0 rounded-md border overflow-hidden">
                  <canvas
                    ref="jsxCanvasRef"
                    class="block w-full h-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="gson" class="flex-1 min-h-0 mt-3 data-[state=inactive]:hidden">
          <div class="h-full rounded-md border bg-white min-h-0 flex flex-col">
            <div class="p-3 border-b flex items-center gap-2 flex-wrap">
              <Select v-model="selectedGsonDemoId">
                <SelectTrigger class="w-[260px] h-9">
                  <SelectValue placeholder="Выберите пример JSON" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in GSON_DEMO_OPTIONS"
                    :key="opt.id"
                    :value="opt.id"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                class="h-9 w-9"
                :disabled="!selectedGsonDemoId"
                title="Подставить пример в редактор"
                @click="insertGSONDemo"
              >
                <i class="ti ti-file-import text-lg" />
              </Button>
            </div>

            <div class="p-3 pt-2 text-[11px] text-muted-foreground" v-if="gsonError">
              {{ gsonError }}
            </div>

            <div class="min-h-0 flex-1 border-t flex">
              <div class="w-1/2 min-w-0 p-3 border-r">
                <Label class="font-semibold mb-2 block">JSON редактор</Label>
                <ScriptEditor
                  :model-value="gsonScript"
                  class="h-[calc(100%-28px)] min-h-0"
                  @update:model-value="onGSONInput"
                />
              </div>
              <div class="w-1/2 min-w-0 p-3">
                <Label class="font-semibold mb-2 block">Canvas предпросмотр</Label>
                <div class="h-[calc(100%-28px)] min-h-0 rounded-md border overflow-hidden">
                  <canvas
                    ref="gsonCanvasRef"
                    class="block w-full h-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="table" class="flex-1 min-h-0 mt-3 data-[state=inactive]:hidden">
          <div class="h-full rounded-md border bg-white min-h-0 flex flex-col">
            <div class="p-3 border-b flex items-center gap-2 flex-wrap">
              <Select v-model="selectedTableDemoId">
                <SelectTrigger class="w-[280px] h-9">
                  <SelectValue placeholder="Выберите пример Table JSON" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in TABLE_DEMO_OPTIONS"
                    :key="opt.id"
                    :value="opt.id"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                class="h-9 w-9"
                :disabled="!selectedTableDemoId"
                title="Подставить пример в редактор"
                @click="insertTableDemo"
              >
                <i class="ti ti-file-import text-lg" />
              </Button>
            </div>

            <div class="p-3 pt-2 text-[11px] text-muted-foreground" v-if="tableError">
              {{ tableError }}
            </div>

            <div class="min-h-0 flex-1 border-t flex">
              <div class="w-1/2 min-w-0 p-3 border-r">
                <Label class="font-semibold mb-2 block">Table JSON редактор</Label>
                <ScriptEditor
                  :model-value="tableScript"
                  class="h-[calc(100%-28px)] min-h-0"
                  @update:model-value="onTableInput"
                />
              </div>
              <div class="w-1/2 min-w-0 p-3">
                <Label class="font-semibold mb-2 block">Canvas предпросмотр</Label>
                <div
                  ref="tableViewportRef"
                  class="h-[calc(100%-28px)] min-h-0 rounded-md border overflow-auto cursor-grab active:cursor-grabbing"
                >
                  <canvas
                    ref="tableCanvasRef"
                    class="block"
                    @mousedown="onTableCanvasMouseDown"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>
