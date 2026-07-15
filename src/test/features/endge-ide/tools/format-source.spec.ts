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

    expect(formatted).toContain(`row.attributes[name = 'STA'].dateTime`)
    expect(formatted).toContain(`row.items[code = 'Bridge On'].value`)
    expect(formatted).not.toContain('[(')
  })
})
