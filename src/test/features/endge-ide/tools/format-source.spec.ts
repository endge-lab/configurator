import { describe, expect, it } from 'vitest'

import { formatSource } from '@/features/endge-ide/tools/format-source'

describe('formatSource', () => {
  it('formats a complete Vue SFC including its TypeScript and template blocks', async () => {
    const source = '<script setup lang="ts">defineProps<{flight:{id:string}}>()</script><template><Flex row gap="2"><Text>{{flight.id}}</Text></Flex></template><style lang="endgecss" scoped></style>'

    await expect(formatSource(source, 'vue')).resolves.toBe(`<script setup lang="ts">
defineProps<{ flight: { id: string } }>()
</script>
<template>
  <Flex row gap="2">
    <Text>{{ flight.id }}</Text>
  </Flex>
</template>
<style lang="endgecss" scoped></style>
`)
  })

  it('formats JSON as JSON instead of treating it as generic source', async () => {
    await expect(
      formatSource('{"flight":{"id":1,"active":true}}', 'json'),
    ).resolves.toBe('{ "flight": { "id": 1, "active": true } }\n')
  })

  it('formats TypeScript source', async () => {
    await expect(
      formatSource('const flight:{id:string}={id:"SU100"}', 'typescript'),
    ).resolves.toBe('const flight: { id: string } = { id: \'SU100\' }\n')
  })

  it('formats standalone EndgeCSS with its SCSS-compatible grammar', async () => {
    const source = `Table{&::part(cell){border-right:1px solid #355a82}}// Grid lines
@theme dark{Table{color:#fff}}`

    await expect(formatSource(source, 'scss')).resolves.toBe(`Table {
  &::part(cell) {
    border-right: 1px solid #355a82;
  }
} // Grid lines
@theme dark {
  Table {
    color: #fff;
  }
}
`)
  })

  it('preserves Endge DataPath selectors instead of converting them to assignments', async () => {
    const source = `<template><Text :ACTail="row.arrivalLeg.attributes[name = 'ACTail']">{{ row.arrivalLeg.attributes[code='Arrival'].text }}</Text></template>`

    const formatted = await formatSource(source, 'vue')

    expect(formatted).toContain(
      `:ACTail="row.arrivalLeg.attributes[name = 'ACTail']"`,
    )
    expect(formatted).toContain(
      `{{ row.arrivalLeg.attributes[code='Arrival'].text }}`,
    )
    expect(formatted).not.toContain('attributes[(name = \'ACTail\')]')
    expect(formatted).not.toContain('attributes[(code = \'Arrival\')]')
  })

  it('repairs DataPath selectors wrapped by an earlier Prettier pass', async () => {
    const source = `<template><DateTime v-if="row.attributes[(name = 'STA')].dateTime" :value="row.items[(code = 'Bridge On')].value" /></template>`

    const formatted = await formatSource(source, 'vue')

    expect(formatted).toContain(`if="row.attributes[name = 'STA'].dateTime"`)
    expect(formatted).not.toContain('v-if=')
    expect(formatted).toContain(`row.attributes[name = 'STA'].dateTime`)
    expect(formatted).toContain(`row.items[code = 'Bridge On'].value`)
    expect(formatted).not.toContain('[(')
  })

  it('normalizes Vue control-flow directives to canonical Endge SFC syntax', async () => {
    const source = `<script setup lang="ts">const example = 'v-if="ready"'</script><template><!-- v-if="comment" --><Flex v-if="ready"><Text v-for="item in items" v-show="visible">{{ item }}</Text></Flex><Text v-else-if="pending">Pending</Text><Text v-else>Done</Text><Text>v-if="documentation"</Text></template>`

    const formatted = await formatSource(source, 'vue')

    expect(formatted).toContain('<Flex if="ready">')
    expect(formatted).toContain('<Text for="item in items" v-show="visible">')
    expect(formatted).toContain('<Text else-if="pending">Pending</Text>')
    expect(formatted).toContain('<Text else>Done</Text>')
    expect(formatted).toContain('<!-- v-if="comment" -->')
    expect(formatted).toContain('const example = \'v-if="ready"\'')
    expect(formatted).toContain('<Text>v-if="documentation"</Text>')
  })

  it('formats EndgeCSS rules, directives, nesting and comments inside an SFC', async () => {
    const source = `<template><Table id="flights" /></template><style lang="endgecss" scoped>#flights::part(header){background-color:#1e3a5f;font-weight:600}@theme dark{#flights::part(header-content){color:#fff}}// Grid lines
Table{&::part(cell){border-right:1px solid #355a82}}</style>`

    const formatted = await formatSource(source, 'vue')

    expect(formatted).toContain(`<style lang="endgecss" scoped>
  #flights::part(header) {
    background-color: #1e3a5f;
    font-weight: 600;
  }
  @theme dark {
    #flights::part(header-content) {
      color: #fff;
    }
  } // Grid lines
  Table {
    &::part(cell) {
      border-right: 1px solid #355a82;
    }
  }
</style>`)
    expect(formatted).not.toContain('lang="scss"')
    expect(formatted).not.toContain('data-endge-format-style')
  })

  it('formats a style block without lang as EndgeCSS and keeps lang omitted', async () => {
    const formatted = await formatSource(
      '<template><Text /></template><style scoped>Text{color:red;&:state(delayed){font-weight:700}}</style>',
      'vue',
    )

    expect(formatted).toContain(`<style scoped>
  Text {
    color: red;
    &:state(delayed) {
      font-weight: 700;
    }
  }
</style>`)
    expect(formatted).not.toContain('lang="scss"')
  })
})
