export const TIMELINE_CHART_CREATE_KIND = 'timeline-chart' as const
export const TIMELINE_GROUP_CREATE_KIND = 'timeline-group' as const

const start = Date.UTC(2026, 10, 18, 8)
const hour = 3_600_000
const range = { start, end: start + hour * 4 }
const options = {
  timezone: 'Europe/Moscow',
  timeRange: { ...range, min: start - hour * 12, max: start + hour * 18 },
  ungroupedPanel: { enabled: false },
  scroll: { horizontalBarEnabled: true, mainVerticalBarEnabled: true },
}

function dataset(id: string, label: string) {
  return {
    groups: [{ id, title: label }],
    tasks: [
      { id: `${id}-1`, groupId: id, title: 'FV 6011', startTime: start + hour * 0.4, endTime: start + hour * 1.4 },
      { id: `${id}-2`, groupId: id, title: 'SU 1250', startTime: start + hour * 2.2, endTime: start + hour * 3.5 },
    ],
  }
}

const chart = dataset('flights', 'Рейсы')
const columns = [{ id: 'title', title: 'Группа', field: 'title', width: 160, sortable: true }]
const resources = [
  { id: 'runway', title: 'ВПП' },
  { id: 'stands', title: 'Места стоянки' },
  { id: 'domestic', title: 'Терминал ВВЛ' },
  { id: 'international', title: 'Терминал МВЛ' },
].map(resource => ({ ...resource, data: dataset(resource.id, resource.title) }))

export const TIMELINE_CHART_SOURCE = `<script setup lang="ts">
const props = defineProps<{ flights: unknown }>()
definePreviewProps({ flights: ${JSON.stringify(chart)} })
</script>

<template>
  <TimelineChart :data="props.flights" :columns='${JSON.stringify(columns)}'
                 :options='${JSON.stringify(options)}' :height="280" />
</template>
`

export const TIMELINE_GROUP_SOURCE = `<script setup lang="ts">
const props = defineProps<{ flights: unknown, resources: Array<{ id: string, title: string, data: unknown }> }>()
definePreviewProps({ flights: ${JSON.stringify(chart)}, resources: ${JSON.stringify(resources)} })
</script>

<template>
  <TimelineGroup sync="time" splitter :label-width="160" :range='${JSON.stringify(range)}'>
    <TimelineChart key="flights" title="Рейсы" :data="props.flights" :columns='${JSON.stringify(columns)}'
                   :options='${JSON.stringify(options)}' :height="180" :min-height="100" />
    <TimelineChart for="resource in props.resources" :key="resource.id"
                   :title="resource.title" :data="resource.data" preset="demo-resource-load"
                   :settings="{ color: '#478ACF', labels: true }"
                   :options='${JSON.stringify({ ...options, timeScale: { enabled: false } })}'
                   :height="92" :min-height="64" :max-height="280" />
  </TimelineGroup>
</template>
`

export function timelineTemplateFor(kind: string): string | undefined {
  return kind === TIMELINE_CHART_CREATE_KIND
    ? TIMELINE_CHART_SOURCE
    : kind === TIMELINE_GROUP_CREATE_KIND ? TIMELINE_GROUP_SOURCE : undefined
}
