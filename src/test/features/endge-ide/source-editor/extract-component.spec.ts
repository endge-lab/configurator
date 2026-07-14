import { describe, expect, it } from 'vitest'

import { analyzeExtractableSFCColumns } from '@/features/endge-ide/source-editor/contributions/component-sfc/extract-component/extract-component.analysis'
import {
  buildExtractedComponentSource,
  replaceExtractedColumnBody,
} from '@/features/endge-ide/source-editor/contributions/component-sfc/extract-component/extract-component.transform'

describe('sFC Column extract component contribution', () => {
  it('extracts Cell children and groups row field reads into one prop', () => {
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
    expect(source.slice(columns[0]!.columnRange.start, columns[0]!.tagNameEnd)).toBe('<Column')
  })

  it('anchors the inline action on the tag-name line for a multiline Column', () => {
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
    const anchorPrefix = source.slice(0, column!.tagNameEnd)

    expect(source.slice(column!.columnRange.start, column!.tagNameEnd)).toBe('<Column')
    expect(anchorPrefix.split('\n')).toHaveLength(3)
  })

  it('supports a Column without Cell and keeps v-for aliases local', () => {
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

  it('does not offer export for an existing direct component reference', () => {
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

  it('extracts plain text from a Column without Cell', () => {
    const source = `<template>
  <Table>
    <Column key="status">Нет данных</Column>
  </Table>
</template>`

    const [column] = analyzeExtractableSFCColumns(source)

    expect(column?.bodySource).toBe('Нет данных')
    expect(column?.dependencies).toEqual([])
  })

  it('keeps Cell in the table and calls the new component by tag', () => {
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
      dependencies: column!.dependencies.map(({ hasWrite: _hasWrite, ...dependency }) => dependency),
    }
    const parentSource = replaceExtractedColumnBody(source, column!, result)
    const childSource = buildExtractedComponentSource(column!, result.dependencies)

    expect(parentSource).toContain('<Cell>\n        <Module.AircraftTail :row="row" />\n      </Cell>')
    expect(childSource).toContain('defineProps<{\n  row: unknown\n}>()')
    expect(childSource).toContain('<template>\n  <Text>{{ row.tail }}</Text>\n</template>')
  })

  it('uses Component is when tag is empty and blocks writable dependencies', () => {
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
      dependencies: column!.dependencies.map(({ hasWrite: _hasWrite, ...dependency }) => dependency),
    }
    const parentSource = replaceExtractedColumnBody(source, column!, result)

    expect(parentSource).toContain('<Component is="aircraft-tail" :row="row" />')
  })

  it('treats Endge attribute selectors as row reads, not writable props', () => {
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
})
