import type { NovaSchema, NovaSchemaItem } from '@/features/nova/domain/types/renderer-types'

export type NovaTableCellAlign = 'left' | 'center' | 'right'

export interface NovaTableColumn {
  key: string
  title: string
  width?: number
  align?: NovaTableCellAlign
}

export type NovaTableRow = Record<string, string | number | boolean | null | undefined>

export interface NovaTablePalette {
  headerBg?: string
  headerText?: string
  rowBg?: string
  rowAltBg?: string
  rowText?: string
  border?: string
}

export interface NovaTableComponentInput {
  x: number
  y: number
  width: number
  height: number
  columns: NovaTableColumn[]
  rows: NovaTableRow[]
  rowHeight?: number
  headerHeight?: number
  showRowIndex?: boolean
  palette?: NovaTablePalette
}

export interface NovaTableModel extends Omit<NovaTableComponentInput, 'x' | 'y' | 'width' | 'height'> {
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
}

const DEFAULT_HEADER_HEIGHT = 36
const DEFAULT_ROW_HEIGHT = 32

function toText(value: unknown): string {
  if (value === null || value === undefined)
    return ''
  return String(value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function resolveColumns(
  columns: NovaTableColumn[],
  tableWidth: number,
  showRowIndex: boolean,
): Array<NovaTableColumn & { width: number }> {
  const indexWidth = showRowIndex ? 56 : 0
  const contentWidth = Math.max(0, tableWidth - indexWidth)
  const explicitWidth = columns.reduce((acc, col) => acc + (col.width ?? 0), 0)
  const autoCount = columns.filter(col => !col.width).length
  const remainWidth = Math.max(0, contentWidth - explicitWidth)
  const autoWidth = autoCount > 0 ? remainWidth / autoCount : 0

  return columns.map((col) => {
    const width = col.width ?? autoWidth
    return {
      ...col,
      width: Math.max(60, width),
    }
  })
}

/**
 * Формирует плоскую NovaSchema для таблицы.
 */
export function createNovaTableSchema(input: NovaTableComponentInput): NovaSchema {
  const {
    x,
    y,
    width,
    height,
    columns,
    rows,
    palette,
    showRowIndex = true,
    rowHeight = DEFAULT_ROW_HEIGHT,
    headerHeight = DEFAULT_HEADER_HEIGHT,
  } = input

  const schema: NovaSchema = []
  const safeWidth = Math.max(120, width)
  const safeHeight = Math.max(80, height)
  const normalizedColumns = resolveColumns(columns, safeWidth, showRowIndex)
  const maxRows = clamp(Math.floor((safeHeight - headerHeight) / rowHeight), 0, rows.length)

  const colors = {
    headerBg: palette?.headerBg ?? '#E2E8F0',
    headerText: palette?.headerText ?? '#0F172A',
    rowBg: palette?.rowBg ?? '#FFFFFF',
    rowAltBg: palette?.rowAltBg ?? '#F8FAFC',
    rowText: palette?.rowText ?? '#0F172A',
    border: palette?.border ?? '#CBD5E1',
  }

  schema.push({
    type: 'rect',
    x,
    y,
    width: safeWidth,
    height: safeHeight,
    styles: {
      background: '#FFFFFF',
      border: { color: colors.border, width: 1 },
    },
  })

  schema.push({
    type: 'rect',
    x,
    y,
    width: safeWidth,
    height: headerHeight,
    styles: {
      background: colors.headerBg,
      border: { color: colors.border, width: 1 },
    },
  })

  let headerX = x
  if (showRowIndex) {
    schema.push({
      type: 'text',
      text: '#',
      x: headerX + 8,
      y: y + 8,
      width: 40,
      height: headerHeight - 16,
      styles: {
        color: colors.headerText,
        font: { size: 13, weight: '700' },
      },
    })

    schema.push({
      type: 'line',
      x1: x + 56,
      y1: y,
      x2: x + 56,
      y2: y + safeHeight,
      styles: { color: colors.border, width: 1 },
    })
    headerX += 56
  }

  for (const col of normalizedColumns) {
    schema.push({
      type: 'text',
      text: col.title,
      x: headerX + 8,
      y: y + 8,
      width: col.width - 16,
      height: headerHeight - 16,
      styles: {
        color: colors.headerText,
        font: { size: 13, weight: '700' },
      },
    })

    schema.push({
      type: 'line',
      x1: headerX + col.width,
      y1: y,
      x2: headerX + col.width,
      y2: y + safeHeight,
      styles: { color: colors.border, width: 1 },
    })
    headerX += col.width
  }

  schema.push({
    type: 'line',
    x1: x,
    y1: y + headerHeight,
    x2: x + safeWidth,
    y2: y + headerHeight,
    styles: { color: colors.border, width: 1 },
  })

  for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
    const rowTop = y + headerHeight + rowIndex * rowHeight
    const row = rows[rowIndex] ?? {}
    const bgColor = rowIndex % 2 === 0 ? colors.rowBg : colors.rowAltBg

    schema.push({
      type: 'rect',
      x,
      y: rowTop,
      width: safeWidth,
      height: rowHeight,
      styles: { background: bgColor },
    })

    schema.push({
      type: 'line',
      x1: x,
      y1: rowTop + rowHeight,
      x2: x + safeWidth,
      y2: rowTop + rowHeight,
      styles: { color: colors.border, width: 1 },
    })

    let cellX = x
    if (showRowIndex) {
      schema.push({
        type: 'text',
        text: String(rowIndex + 1),
        x: cellX + 8,
        y: rowTop + 7,
        width: 40,
        height: rowHeight - 14,
        styles: {
          color: '#64748B',
          font: { size: 12, weight: '600' },
          align: { horizontal: 'right', vertical: 'middle' },
        },
      })
      cellX += 56
    }

    for (const col of normalizedColumns) {
      const value = toText(row[col.key])
      schema.push({
        type: 'text',
        text: value,
        x: cellX + 8,
        y: rowTop + 7,
        width: col.width - 16,
        height: rowHeight - 14,
        styles: {
          color: colors.rowText,
          font: { size: 12, weight: '400' },
          align: { horizontal: col.align ?? 'left', vertical: 'middle' },
          ellipsis: true,
        },
      } satisfies NovaSchemaItem)

      cellX += col.width
    }
  }

  return schema
}

export function createNovaTableSchemaFromModel(model: NovaTableModel): NovaSchema {
  return createNovaTableSchema({
    x: model.bounds.x,
    y: model.bounds.y,
    width: model.bounds.width,
    height: model.bounds.height,
    columns: model.columns,
    rows: model.rows,
    rowHeight: model.rowHeight,
    headerHeight: model.headerHeight,
    showRowIndex: model.showRowIndex,
    palette: model.palette,
  })
}
