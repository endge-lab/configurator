<script setup lang="ts">
import { ComponentType, Endge, RComponentTableColumn_isComponent, RComponentTableColumn_isHtml } from '@endge/core'
import { Raph } from '@endge/raph'
import { ComponentType_TableV2 as ComponentType_Table } from '@endge/vue'
import { ComponentType_DSL_Canvas, NovaGraphics, createNovaTableSchemaFromModel } from '@endge/nova'
import type { NovaSchema, NovaTableColumn, NovaTableModel, NovaTableRow } from '@endge/nova'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const tableRt = computed(() => EndgeIDE.demonstration.tableRt.value)
const tableBasePath = computed(() => EndgeIDE.demonstration.tableBasePath.value)
const helpData = computed(() => EndgeIDE.demonstration.helpData.value)

const activeTab = ref('revo')
const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasViewportRef = ref<HTMLDivElement | null>(null)
const canvasSchema = ref<NovaSchema>([])
const canvasError = ref('')
const canvasWidth = ref(900)
const canvasHeight = ref(520)
const canvasContentWidth = ref(900)
const canvasContentHeight = ref(520)
const canvasColumnWidthOverrides = ref<Record<string, number>>({})
const canvasResolvedColumns = ref<Array<NovaTableColumn & { width: number }>>([])
const canvasTableBounds = ref({
  x: 16,
  y: 16,
  width: 760,
  height: 420,
  headerHeight: 38,
  rowHeight: 34,
  showRowIndex: true,
})
const isColumnResizing = ref(false)
const resizingColumnIndex = ref(-1)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)
const canvasVisibleStartRow = ref(0)
const canvasVisibleEndRow = ref(0)
let unsubscribeStore: (() => void) | null = null

function inferColumns(rows: NovaTableRow[]): NovaTableColumn[] {
  const keys = new Set<string>()
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      keys.add(key)
    })
  })
  return Array.from(keys).map((key) => {
    const title = key
      .replace(/_/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .trim()
    return {
      key,
      title: title ? `${title.charAt(0).toUpperCase()}${title.slice(1)}` : key,
      align: 'left' as const,
    }
  })
}

function resolveDisplayColumns(
  columns: NovaTableColumn[],
  tableWidth: number,
  showRowIndex: boolean,
  widthOverrides: Record<string, number>,
): Array<NovaTableColumn & { width: number }> {
  const indexWidth = showRowIndex ? 56 : 0
  const contentWidth = Math.max(0, tableWidth - indexWidth)
  const explicitWidth = columns.reduce((acc, col) => acc + (col.width ?? 0), 0)
  const autoCount = columns.filter(col => !col.width).length
  const remainWidth = Math.max(0, contentWidth - explicitWidth)
  const autoWidth = autoCount > 0 ? remainWidth / autoCount : 0

  return columns.map((col) => {
    const overrideWidth = widthOverrides[col.key]
    const width = overrideWidth ?? col.width ?? autoWidth
    return {
      ...col,
      width: Math.max(60, width),
    }
  })
}

function normalizeRows(input: unknown[]): NovaTableRow[] {
  const out: NovaTableRow[] = []
  for (const item of input) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      out.push(item as NovaTableRow)
      continue
    }
    out.push({ value: item } as NovaTableRow)
  }
  return out
}

function normalizeCellValue(value: unknown): string | number | boolean | null | undefined {
  if (value == null)
    return value as null | undefined
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return value
  return String(value)
}

function getRowsFromHelpData(): unknown[] {
  const payload = helpData.value
  const key = payload?.activeTabKey
  const source = key ? payload?.resultByKey?.[key] : null
  return Array.isArray(source) ? source : []
}

function getRowsAndColumnsFromRuntime(): { rows: NovaTableRow[]; columns: NovaTableColumn[] } {
  const runtime = tableRt.value as any
  const tableId = String(runtime?.node?.meta?.entityId ?? '')
  const basePath = String(runtime?.node?.meta?.basePath ?? '')
  if (!tableId || !basePath) {
    return { rows: [], columns: [] }
  }

  const tableModel = Endge.domain.getComponent(tableId) as any
  if (!tableModel) {
    return { rows: [], columns: [] }
  }

  const sourceKeys = tableModel?.bindings?.keys ?? {}
  const sourceVar = Object.keys(sourceKeys)[0] || tableModel?.inputFields?.[tableModel?.sourceIndex]?.name || ''
  const path = sourceVar ? `${basePath}.${sourceVar}` : ''
  const rawRows = path ? Raph.get(path, { vars: { store: basePath } }) : []
  const rows = normalizeRows(Array.isArray(rawRows) ? rawRows : [])

  const activeColumns = (tableModel?.columns ?? [])
    .filter((x: any) => x?.isActive)
    .filter((x: any) => !RComponentTableColumn_isHtml(x))

  const columns: NovaTableColumn[] = activeColumns.map((col: any) => ({
    key: String(col?.id ?? col?.identity ?? ''),
    title: String(col?.title ?? col?.id ?? 'Column'),
    width: Number.isFinite(Number(col?.width)) ? Number(col.width) : undefined,
    align: String(col?.align ?? '').toLowerCase() === 'center'
      ? 'center'
      : String(col?.align ?? '').toLowerCase() === 'right'
          ? 'right'
          : 'left',
  }))

  // Если у модели есть колонки, но не совпадают ключи строк,
  // строим проекцию строки по column.id/dataPath.
  if (columns.length && rows.length) {
    const projectedRows: NovaTableRow[] = rows.map((row, rowIndex) => {
      const nextRow: NovaTableRow = {}
      for (const col of activeColumns) {
        const colId = String(col?.id ?? col?.identity ?? '')
        let value: unknown = (row as any)?.[colId]

        if (value == null && col?.sort?.by) {
          const by = String(col.sort.by)
          value = by.includes('.') ? by.split('.').reduce((acc: any, k: string) => acc?.[k], row as any) : (row as any)?.[by]
        }

        if (value == null && col?.dataPaths && typeof col.dataPaths === 'object') {
          const firstPath = Object.values(col.dataPaths)[0]
          if (typeof firstPath === 'string' && firstPath.length) {
            value = Raph.get(firstPath, { vars: { store: basePath, i: rowIndex } })
          }
        }

        nextRow[colId] = normalizeCellValue(value)
      }
      return nextRow
    })
    return { rows: projectedRows, columns }
  }

  return { rows, columns }
}

function getRowsFromStore(): unknown[] {
  const basePath = tableBasePath.value
  if (!basePath)
    return []
  const store = Endge.store as { getState?: (storeKey: string) => unknown } | undefined
  if (!store?.getState)
    return []
  const state = store.getState(basePath)
  if (!state || typeof state !== 'object')
    return []
  for (const key of Object.keys(state as Record<string, unknown>)) {
    const value = (state as Record<string, unknown>)[key]
    if (Array.isArray(value))
      return value
  }
  return []
}

function applyConverterChain(value: unknown, spec: string | undefined): unknown {
  if (!spec)
    return value
  const ids = String(spec).split(',').map(s => s.trim()).filter(Boolean)
  let current: unknown = value
  for (const id of ids) {
    const converter = Endge.domain.getConverter(id)
    if (!converter)
      continue
    current = converter.convert(current)
  }
  return current
}

function extractColumnComData(column: any, rowIndex: number, basePath: string): Record<string, unknown> {
  const inputs = typeof column?.getInputs === 'function' ? column.getInputs() : {}
  const extracted: Record<string, unknown> = Object.fromEntries(
    Object.entries(column?.dataPaths ?? {}).map(([key, path]) => {
      if (!path || !String(path).length)
        return [key, null]

      const basePathRaw = String(basePath ?? '')
      const storeParts = basePathRaw.split('.').filter(Boolean)
      const storeVars: Record<string, string> = Object.fromEntries(
        storeParts.map((seg: string, idx: number) => [`store${idx + 1}`, seg]),
      )
      const storeChain = storeParts.length > 0
        ? storeParts.map((_seg: string, idx: number) => `$store${idx + 1}`).join('.')
        : '$store'
      const patchedPath = String(path).replace(/\$store\b/g, storeChain)

      return [
        key,
        Raph.get(patchedPath, {
          vars: {
            ...storeVars,
            i: rowIndex,
          },
        }),
      ]
    }),
  )

  for (const key of Object.keys(extracted)) {
    if (!inputs[key])
      continue
    const spec = column?.dataConverters?.[key]
    if (!spec)
      continue
    extracted[key] = applyConverterChain(extracted[key], spec)
  }

  return extracted
}

function buildCanvasSchema(): void {
  try {
    const runtimeData = getRowsAndColumnsFromRuntime()
    let rows = runtimeData.rows
    let columns = runtimeData.columns

    if (!rows.length || !columns.length) {
      const sourceRows = getRowsFromHelpData()
      const fallbackRows = sourceRows.length ? sourceRows : getRowsFromStore()
      rows = normalizeRows(fallbackRows)
      columns = inferColumns(rows)
    }

    if (!rows.length || !columns.length) {
      canvasSchema.value = []
      canvasError.value = 'Нет данных для Canvas-рендера.'
      return
    }

    const rowHeight = 34
    const headerHeight = 38
    const topPadding = 16
    const bottomPadding = 24
    const viewportWidth = Math.max(760, (canvasViewportRef.value?.clientWidth ?? 900) - 32)
    const viewportHeight = Math.max(260, canvasViewportRef.value?.clientHeight ?? 520)
    const scrollTop = canvasViewportRef.value?.scrollTop ?? 0
    const scrollLeft = canvasViewportRef.value?.scrollLeft ?? 0
    const resolvedForWidth = resolveDisplayColumns(
      columns,
      Math.max(viewportWidth, columns.length * 120),
      true,
      canvasColumnWidthOverrides.value,
    )
    const calculatedContentWidth = resolvedForWidth.reduce((acc, col) => acc + col.width, 0)
    const tableWidth = Math.max(viewportWidth, calculatedContentWidth + 56)
    const tableHeight = Math.max(headerHeight + rowHeight, headerHeight + rows.length * rowHeight)

    const dataStartPx = Math.max(0, scrollTop - topPadding - headerHeight)
    const dataEndPx = Math.max(0, scrollTop + viewportHeight - topPadding - headerHeight)
    const bufferRows = 6
    const visibleStart = Math.max(0, Math.floor(dataStartPx / rowHeight) - bufferRows)
    const visibleEnd = Math.min(rows.length - 1, Math.ceil(dataEndPx / rowHeight) + bufferRows)
    canvasVisibleStartRow.value = visibleStart
    canvasVisibleEndRow.value = Math.max(visibleStart, visibleEnd)
    const visibleRows = rows.slice(canvasVisibleStartRow.value, canvasVisibleEndRow.value + 1)
    const windowOffsetY = scrollTop - canvasVisibleStartRow.value * rowHeight
    const modelY = topPadding - windowOffsetY

    const model: NovaTableModel = {
      bounds: { x: 16 - scrollLeft, y: modelY, width: tableWidth, height: headerHeight + visibleRows.length * rowHeight },
      showRowIndex: true,
      headerHeight,
      rowHeight,
      palette: {
        headerBg: '#E2E8F0',
        headerText: '#0F172A',
        rowBg: '#FFFFFF',
        rowAltBg: '#F8FAFC',
        rowText: '#0F172A',
        border: '#CBD5E1',
      },
      columns,
      rows: visibleRows,
    }

    const baseSchema = createNovaTableSchemaFromModel(model)

    const runtime = tableRt.value as any
    const tableId = String(runtime?.node?.meta?.entityId ?? '')
    const basePath = String(runtime?.node?.meta?.basePath ?? '')
    const tableModel = tableId ? Endge.domain.getComponent(tableId) as any : null
    const activeColumnsRaw = (tableModel?.columns ?? [])
      .filter((x: any) => x?.isActive)
      .filter((x: any) => !RComponentTableColumn_isHtml(x))

    const resolvedColumns = resolveDisplayColumns(
      model.columns,
      model.bounds.width,
      !!model.showRowIndex,
      canvasColumnWidthOverrides.value,
    )
    const modelHeaderHeight = model.headerHeight ?? 38
    const modelRowHeight = model.rowHeight ?? 34
    const visibleRowsCount = visibleRows.length
    canvasResolvedColumns.value = resolvedColumns
    canvasTableBounds.value = {
      x: model.bounds.x,
      y: model.bounds.y,
      width: model.bounds.width,
      height: model.bounds.height,
      headerHeight: modelHeaderHeight,
      rowHeight: modelRowHeight,
      showRowIndex: !!model.showRowIndex,
    }

    const scope = Endge.script.getScope('demonstration-canvas-table')
    const cellSchema: NovaSchema = []

    for (let rowIndex = 0; rowIndex < visibleRowsCount; rowIndex++) {
      const cellTop = model.bounds.y + modelHeaderHeight + rowIndex * modelRowHeight
      let cellLeft = model.bounds.x + (model.showRowIndex ? 56 : 0)
      const sourceRowIndex = canvasVisibleStartRow.value + rowIndex

      for (let colIndex = 0; colIndex < resolvedColumns.length; colIndex++) {
        const displayCol = resolvedColumns[colIndex]
        if (!displayCol) {
          continue
        }
        const rawColumn = activeColumnsRaw[colIndex]
        const bounds = {
          x: cellLeft + 4,
          y: cellTop + 4,
          width: Math.max(0, displayCol.width - 8),
          height: Math.max(0, rowHeight - 8),
        }

        if (
          rawColumn
          && RComponentTableColumn_isComponent(rawColumn)
          && rawColumn.componentId
        ) {
          const component = Endge.domain.getComponent(rawColumn.componentId) as any
          if (component && component.type === ComponentType.DSL) {
            if (!component.ast && typeof component.compile === 'function') {
              component.compile()
            }
            const comData = extractColumnComData(rawColumn, sourceRowIndex, basePath)
            const rendered = ComponentType_DSL_Canvas({
              model: component,
              scope,
              comData,
              context: {
                rowIndex: sourceRowIndex,
                rowNumber: sourceRowIndex + 1,
              },
              bounds,
            })
            const clipBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
            cellSchema.push(...rendered.map(item => ({ ...item, clip: clipBounds })))
          } else {
            cellSchema.push({
              type: 'text',
              text: String(rows[sourceRowIndex]?.[displayCol.key] ?? ''),
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height,
              clip: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
              styles: {
                color: '#0F172A',
                font: { size: 12, weight: '400' },
                align: { horizontal: displayCol.align ?? 'left', vertical: 'middle' },
                ellipsis: true,
              },
            })
          }
        } else {
          cellSchema.push({
            type: 'text',
            text: String(rows[sourceRowIndex]?.[displayCol.key] ?? ''),
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            clip: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
            styles: {
              color: '#0F172A',
              font: { size: 12, weight: '400' },
              align: { horizontal: displayCol.align ?? 'left', vertical: 'middle' },
              ellipsis: true,
            },
          })
        }

        cellLeft += displayCol.width
      }
    }

    canvasSchema.value = [...baseSchema, ...cellSchema]
    canvasWidth.value = Math.max(640, viewportWidth)
    canvasHeight.value = Math.max(260, viewportHeight)
    canvasContentWidth.value = Math.max(900, 16 + tableWidth + 24)
    canvasContentHeight.value = Math.max(520, topPadding + tableHeight + bottomPadding)
    canvasError.value = ''
  } catch (e) {
    canvasSchema.value = []
    canvasError.value = `Ошибка Canvas-таблицы: ${String(e)}`
  }
}

function drawCanvasSchema(ctx: CanvasRenderingContext2D, schema: NovaSchema): void {
  for (const item of schema) {
    let hasClip = false
    const clipRect = item.clip && item.clip !== true ? item.clip : null
    if (clipRect) {
      hasClip = true
      ctx.save()
      ctx.beginPath()
      ctx.rect(clipRect.x, clipRect.y, clipRect.width, clipRect.height)
      ctx.clip()
    }

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
      if (hasClip)
        ctx.restore()
      continue
    }

    if (item.type === 'line') {
      ctx.beginPath()
      ctx.strokeStyle = item.styles?.color || '#111827'
      ctx.lineWidth = item.styles?.width || 1
      ctx.moveTo(item.x1, item.y1)
      ctx.lineTo(item.x2, item.y2)
      ctx.stroke()
      if (hasClip)
        ctx.restore()
      continue
    }

    if (item.type === 'text') {
      const fontSize = item.styles?.font?.size ?? 14
      const fontFamily = item.styles?.font?.family ?? 'Inter'
      const fontWeight = item.styles?.font?.weight ?? 'normal'
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
      ctx.fillStyle = item.styles?.color || '#111827'

      const align = item.styles?.align?.horizontal ?? 'left'
      if (align === 'center')
        ctx.textAlign = 'center'
      else if (align === 'right')
        ctx.textAlign = 'right'
      else
        ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'

      const textX = align === 'center' ? item.x + item.width / 2 : align === 'right' ? item.x + item.width : item.x
      const textY = item.y + item.height / 2
      ctx.fillText(item.text, textX, textY)
      if (hasClip)
        ctx.restore()
      continue
    }

    if (hasClip)
      ctx.restore()
  }
}

function getCanvasPoint(event: MouseEvent): { x: number; y: number } {
  const canvas = canvasRef.value
  if (!canvas)
    return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function getColumnResizeHitIndex(x: number, y: number): number {
  const bounds = canvasTableBounds.value
  if (y < bounds.y || y > bounds.y + bounds.headerHeight)
    return -1

  let cursor = bounds.x + (bounds.showRowIndex ? 56 : 0)
  for (let i = 0; i < canvasResolvedColumns.value.length - 1; i++) {
    const col = canvasResolvedColumns.value[i]
    if (!col)
      continue
    cursor += col.width
    if (Math.abs(x - cursor) <= 5)
      return i
  }
  return -1
}

function onCanvasMouseMove(event: MouseEvent): void {
  if (isColumnResizing.value)
    return
  const canvas = canvasRef.value
  if (!canvas)
    return
  const p = getCanvasPoint(event)
  const hit = getColumnResizeHitIndex(p.x + (canvasViewportRef.value?.scrollLeft ?? 0), p.y)
  canvas.style.cursor = hit >= 0 ? 'col-resize' : 'default'
}

function onCanvasMouseDown(event: MouseEvent): void {
  if (event.button !== 0)
    return
  const p = getCanvasPoint(event)
  const hit = getColumnResizeHitIndex(p.x + (canvasViewportRef.value?.scrollLeft ?? 0), p.y)
  if (hit < 0)
    return

  isColumnResizing.value = true
  resizingColumnIndex.value = hit
  resizeStartX.value = event.clientX
  resizeStartWidth.value = canvasResolvedColumns.value[hit]?.width ?? 150
  event.preventDefault()
}

function renderCanvas(): void {
  const canvas = canvasRef.value
  if (!canvas)
    return

  const dpr = NovaGraphics.dpr()
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return

  const width = canvasWidth.value
  const height = canvasHeight.value
  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, width, height)

  if (canvasError.value) {
    ctx.fillStyle = '#b91c1c'
    ctx.font = '12px monospace'
    ctx.textBaseline = 'top'
    ctx.fillText(canvasError.value, 12, 12)
    return
  }

  drawCanvasSchema(ctx, canvasSchema.value)
}

function scheduleRenderCanvas(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      renderCanvas()
    })
  })
}

function refreshCanvas(): void {
  buildCanvasSchema()
  nextTick(() => {
    scheduleRenderCanvas()
  })
}

function handleResize(): void {
  if (activeTab.value === 'canvas') {
    refreshCanvas()
  }
}

function onWindowMouseMove(event: MouseEvent): void {
  if (!isColumnResizing.value)
    return
  const idx = resizingColumnIndex.value
  if (idx < 0)
    return
  const col = canvasResolvedColumns.value[idx]
  if (!col)
    return
  const nextWidth = Math.max(60, resizeStartWidth.value + (event.clientX - resizeStartX.value))
  canvasColumnWidthOverrides.value = {
    ...canvasColumnWidthOverrides.value,
    [col.key]: nextWidth,
  }
  refreshCanvas()
}

function onWindowMouseUp(): void {
  isColumnResizing.value = false
  resizingColumnIndex.value = -1
}

function onCanvasViewportScroll(): void {
  refreshCanvas()
}

watch(() => helpData.value, refreshCanvas, { deep: true })

watch(tableBasePath, (basePath) => {
  if (unsubscribeStore) {
    unsubscribeStore()
    unsubscribeStore = null
  }
  if (basePath) {
    const store = Endge.store as { subscribe?: (storeKey: string, listener: () => void) => () => void } | undefined
    if (store?.subscribe) {
      unsubscribeStore = store.subscribe(basePath, () => {
        refreshCanvas()
      })
    } else {
      refreshCanvas()
    }
  }
  refreshCanvas()
}, { immediate: true })

watch(activeTab, async (tab) => {
  if (tab !== 'canvas')
    return
  await nextTick()
  refreshCanvas()
  scheduleRenderCanvas()
})

onMounted(() => {
  refreshCanvas()
  window.addEventListener('resize', handleResize)
  window.addEventListener('mousemove', onWindowMouseMove)
  window.addEventListener('mouseup', onWindowMouseUp)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
  if (unsubscribeStore) {
    unsubscribeStore()
    unsubscribeStore = null
  }
})
</script>

<template>
  <div class="h-full w-full flex flex-col min-h-0">
    <p
      v-if="tableBasePath"
      class="text-xs text-muted-foreground px-2 py-1 border-b shrink-0"
    >
      Путь: {{ tableBasePath }}
    </p>
    <template v-if="tableRt">
      <Tabs v-model="activeTab" class="flex-1 min-h-0 flex flex-col">
        <div class="px-2 py-1 border-b">
          <TabsList class="grid grid-cols-2 w-full max-w-[340px]">
            <TabsTrigger value="revo">
              Revo Grid
            </TabsTrigger>
            <TabsTrigger value="canvas">
              Canvas NOVA
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="revo" class="flex-1 min-h-0 data-[state=inactive]:hidden">
          <ComponentType_Table
            class="flex-1 min-h-0"
            :runtime="tableRt"
            enabled-status-bar
          />
        </TabsContent>

        <TabsContent value="canvas" class="flex-1 min-h-0 data-[state=inactive]:hidden p-2">
          <div
            ref="canvasViewportRef"
            class="h-full min-h-0 rounded-md border bg-white overflow-auto"
            @scroll="onCanvasViewportScroll"
          >
            <div
              class="relative"
              :style="{ width: `${canvasContentWidth}px`, height: `${canvasContentHeight}px` }"
            >
              <canvas
                ref="canvasRef"
                class="block sticky top-0 left-0 z-10"
                @mousedown="onCanvasMouseDown"
                @mousemove="onCanvasMouseMove"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </template>
    <div
      v-else
      class="p-4 text-sm text-muted-foreground flex-1"
    >
      Выполните запрос в разделе «Помощь» в инспекторе таблицы, затем нажмите кнопку с иконкой глаза в редакторе таблицы.
    </div>
  </div>
</template>
