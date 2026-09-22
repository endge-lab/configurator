import { describe, expect, it } from 'vitest'

import { analyzeExtractableSFCColumns } from '@/features/endge-ide/source-editor/contributions/component-sfc/extract-component/extract-component.analysis'
import { buildExtractComponentFolderOptions } from '@/features/endge-ide/source-editor/contributions/component-sfc/extract-component/extract-component.folders'
import {
  parseExtractComponentPropsJson,
  serializeExtractComponentPropsJson,
} from '@/features/endge-ide/source-editor/contributions/component-sfc/extract-component/extract-component.props-json'
import {
  buildExtractedComponentSource,
  replaceExtractedColumnBody,
} from '@/features/endge-ide/source-editor/contributions/component-sfc/extract-component/extract-component.transform'

describe('проверка Contribution извлечения компонента из Column SFC', () => {
  it('извлекает дочерние узлы Cell и объединяет чтения полей строки в один prop', () => {
    const source = `<script setup lang="ts">
defineProps<{ flights: FlightLeg[] }>()
</script>

<template>
  <Table :rows="flights">
    <Column key="aircraft" title="ВС">
      <Cell>
        <Flex if="row.tail">
          <Text>{{ row.tail }}</Text>
          <Text>{{ row.type }}</Text>
        </Flex>
      </Cell>
    </Column>
  </Table>
</template>
`

    const columns = analyzeExtractableSFCColumns(source)

    expect(columns).toHaveLength(1)
    expect(columns[0]).toMatchObject({
      columnKey: 'aircraft',
      columnTitle: 'ВС',
      hasCell: true,
      dependencies: [{
        propName: 'row',
        sourceExpression: 'row',
        type: 'unknown',
        paths: ['tail', 'type'],
        hasWrite: false,
      }],
    })
    expect(columns[0]!.bodySource).toContain('<Flex if="row.tail">')
    expect(columns[0]!.bodySource).not.toContain('<Cell>')
    expect(source.slice(columns[0]!.columnRange.start, columns[0]!.actionAnchor))
      .toBe('<Column key="aircraft" title="ВС">')
  })

  it('привязывает inline action к строке имени тега многострочной Column', () => {
    const source = `<template>
  <Table>
    <Column
      key="status"
      title="A > B"
    >
      <Text>Ready</Text>
    </Column>
  </Table>
</template>`

    const [column] = analyzeExtractableSFCColumns(source)
    const anchorPrefix = source.slice(0, column!.actionAnchor)

    expect(source.slice(column!.columnRange.start, column!.actionAnchor)).toBe('<Column')
    expect(source[column!.actionAnchor]).toBe('\n')
    expect(anchorPrefix.split('\n')).toHaveLength(3)
  })

  it('привязывает inline action после однострочного открывающего тега с атрибутами', () => {
    const source = `<template>
  <Table>
    <Column key="nextFlight" title="След > рейс" width="150">
      <Text>Ready</Text>
    </Column>
  </Table>
</template>`

    const [column] = analyzeExtractableSFCColumns(source)

    expect(source.slice(column!.columnRange.start, column!.actionAnchor))
      .toBe('<Column key="nextFlight" title="След > рейс" width="150">')
  })

  it('поддерживает Column без Cell и оставляет aliases v-for локальными', () => {
    const source = `<script setup lang="ts">
defineProps<{ suffix: string }>()
</script>

<template>
  <Table :rows="[]">
    <Column key="items">
      <Text for="item in row.items">{{ item.name }} {{ suffix }}</Text>
    </Column>
  </Table>
</template>`

    const [column] = analyzeExtractableSFCColumns(source)

    expect(column?.hasCell).toBe(false)
    expect(column?.dependencies.map(item => item.propName)).toEqual(['row', 'suffix'])
    expect(column?.dependencies.find(item => item.propName === 'row')?.paths).toEqual(['items'])
    expect(column?.dependencies.some(item => item.propName === 'item')).toBe(false)
  })

  it('не предлагает извлечение для существующей прямой ссылки на компонент', () => {
    const byTag = `<template>
  <Table>
    <Column key="tail"><Cell><AircraftTail :row="row" /></Cell></Column>
  </Table>
</template>`
    const byIdentity = `<template>
  <Table>
    <Column key="tail"><Component is="aircraft-tail" :row="row" /></Column>
  </Table>
</template>`

    expect(analyzeExtractableSFCColumns(byTag)).toEqual([])
    expect(analyzeExtractableSFCColumns(byIdentity)).toEqual([])
  })

  it('извлекает обычный текст из Column без Cell', () => {
    const source = `<template>
  <Table>
    <Column key="status">Нет данных</Column>
  </Table>
</template>`

    const [column] = analyzeExtractableSFCColumns(source)

    expect(column?.bodySource).toBe('Нет данных')
    expect(column?.dependencies).toEqual([])
  })

  it('оставляет Cell в таблице и вызывает новый компонент по тегу', () => {
    const source = `<template>
  <Table>
    <Column key="tail">
      <Cell>
        <Text>{{ row.tail }}</Text>
      </Cell>
    </Column>
  </Table>
</template>`
    const [column] = analyzeExtractableSFCColumns(source)
    expect(column).toBeDefined()

    const result = {
      name: 'Aircraft tail',
      identity: 'aircraft-tail',
      tag: 'Module.AircraftTail',
      folderId: null,
      dependencies: column!.dependencies.map(({ hasWrite: _hasWrite, ...dependency }) => dependency),
    }
    const parentSource = replaceExtractedColumnBody(source, column!, result)
    const childSource = buildExtractedComponentSource(column!, result.dependencies)

    expect(parentSource).toContain('<Cell>\n        <Module.AircraftTail :row="row" />\n      </Cell>')
    expect(childSource).toContain('defineProps<{\n  row: unknown\n}>()')
    expect(childSource).toContain('<template>\n  <Text>{{ row.tail }}</Text>\n</template>')
  })

  it('использует Component is при пустом теге и блокирует изменяемые зависимости', () => {
    const source = `<template>
  <Table>
    <Column key="tail">
      <Input v-model="row.tail" />
    </Column>
  </Table>
</template>`
    const [column] = analyzeExtractableSFCColumns(source)
    expect(column?.dependencies[0]?.hasWrite).toBe(true)

    const result = {
      name: 'Aircraft tail',
      identity: 'aircraft-tail',
      tag: null,
      folderId: null,
      dependencies: column!.dependencies.map(({ hasWrite: _hasWrite, ...dependency }) => dependency),
    }
    const parentSource = replaceExtractedColumnBody(source, column!, result)

    expect(parentSource).toContain('<Component is="aircraft-tail" :row="row" />')
  })

  it('считает селекторы атрибутов Endge чтениями строки, а не изменяемыми props', () => {
    const source = `<template>
  <Table>
    <Column key="tail">
      <Text>{{ row.departureLeg.attributes[name='ACTail'].text }}</Text>
    </Column>
  </Table>
</template>`

    const [column] = analyzeExtractableSFCColumns(source)

    expect(column?.dependencies.map(item => item.propName)).toEqual(['row'])
    expect(column?.dependencies[0]?.hasWrite).toBe(false)
  })

  it('редактирует обнаруженные типы props через плоскую JSON-карту', () => {
    const dependencies = [{
      propName: 'row',
      sourceExpression: 'row',
      type: 'unknown',
      paths: ['tail'],
    }]

    expect(serializeExtractComponentPropsJson(dependencies)).toBe('{\n  "row": "unknown"\n}')
    expect(parseExtractComponentPropsJson('{ "row": "FlightRow" }', dependencies)).toEqual({
      dependencies: [{ ...dependencies[0], type: 'FlightRow' }],
      error: null,
    })
    expect(parseExtractComponentPropsJson('{}', dependencies).error).toContain('row')
    expect(parseExtractComponentPropsJson('{ "row": "unknown", "extra": "string" }', dependencies).error).toContain('extra')
  })

  it('строит дерево папок компонентов с поиском ниже root-components', () => {
    const options = buildExtractComponentFolderOptions([
      { id: 1, identity: 'root-components', displayName: 'Компоненты', entityType: 'components', parent: null },
      { id: 2, identity: 'base', displayName: 'Базовые', entityType: 'components', parent: 1 },
      { id: 3, identity: 'tables', displayName: 'Таблицы', entityType: 'components', parent: 1 },
      { id: 4, identity: 'cells', displayName: 'Ячейки', entityType: 'components', parent: 3 },
      { id: 5, identity: 'query-folder', displayName: 'Запросы', entityType: 'queries', parent: 1 },
      { id: 6, identity: 'archived', displayName: 'Архивная', entityType: 'components', parent: 1, deletedAt: '2026-08-17T00:00:00Z' },
      { id: 7, identity: 'inside-archived', displayName: 'Скрытая', entityType: 'components', parent: 6 },
    ])

    expect(options).toEqual([
      { id: '2', name: 'Базовые', path: 'Базовые', depth: 1 },
      { id: '3', name: 'Таблицы', path: 'Таблицы', depth: 1 },
      { id: '4', name: 'Ячейки', path: 'Таблицы / Ячейки', depth: 2 },
    ])
  })
})
