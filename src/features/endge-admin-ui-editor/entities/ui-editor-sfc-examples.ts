import type { UIEditorSFCBaseTag } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-contract'

export interface UIEditorSFCExample {
  id: string
  tag: UIEditorSFCBaseTag
  title: string
  description: string
  keywords: readonly string[]
  source: string
}

function sfc(script: string, template: string): string {
  return `<script setup lang="ts">
${script}
</script>

<template>
${template}
</template>
`
}

/** Feature-local, runnable examples for every primitive exposed by the UI Editor library. */
export const UI_EDITOR_SFC_EXAMPLES: readonly UIEditorSFCExample[] = [
  {
    id: 'example-text',
    tag: 'Text',
    title: 'Text · Greeting',
    description: 'Две связанные текстовые строки с preview-данными.',
    keywords: ['text', 'copy', 'interpolation'],
    source: sfc(`defineProps<{
  title: string
  passengerName: string
}>()

definePreviewProps({
  title: 'Welcome aboard',
  passengerName: 'Alex Morgan',
})`, `  <Flex direction="column" gap="8px" p="12px">
    <Text>{{ title }}</Text>
    <Text>Hello, {{ passengerName }}</Text>
  </Flex>`),
  },
  {
    id: 'example-datetime',
    tag: 'DateTime',
    title: 'DateTime · Departure',
    description: 'Время отправления, полученное из preview props.',
    keywords: ['date', 'time', 'departure'],
    source: sfc(`defineProps<{
  label: string
  departureAt: string
}>()

definePreviewProps({
  label: 'Scheduled departure',
  departureAt: '2026-07-18T16:45:00+03:00',
})`, `  <Flex direction="row" align="center" gap="8px" p="12px">
    <Text>{{ label }}</Text>
    <DateTime :value="departureAt" />
  </Flex>`),
  },
  {
    id: 'example-number',
    tag: 'Number',
    title: 'Number · Baggage',
    description: 'Числовое значение внутри компактной строки.',
    keywords: ['number', 'weight', 'numeric'],
    source: sfc(`defineProps<{
  label: string
  baggageWeight: number
}>()

definePreviewProps({
  label: 'Baggage',
  baggageWeight: 23.5,
})`, `  <Flex direction="row" align="center" gap="6px" p="12px">
    <Text>{{ label }}</Text>
    <Number :value="baggageWeight" />
    <Text>kg</Text>
  </Flex>`),
  },
  {
    id: 'example-icon',
    tag: 'Icon',
    title: 'Icon · Service',
    description: 'Renderer-neutral icon рядом с подписью сервиса.',
    keywords: ['icon', 'service', 'symbol'],
    source: sfc(`defineProps<{
  iconName: string
  serviceLabel: string
}>()

definePreviewProps({
  iconName: 'wifi',
  serviceLabel: 'Wi-Fi available',
})`, `  <Flex direction="row" align="center" gap="8px" p="12px">
    <Icon :name="iconName" />
    <Text>{{ serviceLabel }}</Text>
  </Flex>`),
  },
  {
    id: 'example-badge',
    tag: 'Badge',
    title: 'Badge · Flight status',
    description: 'Статус рейса с динамическим tone.',
    keywords: ['badge', 'status', 'tone'],
    source: sfc(`defineProps<{
  flightNumber: string
  status: string
  statusTone: string
}>()

definePreviewProps({
  flightNumber: 'SU 1402',
  status: 'Boarding',
  statusTone: 'success',
})`, `  <Flex direction="row" align="center" justify="space-between" gap="12px" p="12px">
    <Text>{{ flightNumber }}</Text>
    <Badge :tone="statusTone">{{ status }}</Badge>
  </Flex>`),
  },
  {
    id: 'example-dot',
    tag: 'Dot',
    title: 'Dot · Live indicator',
    description: 'Компактный индикатор доступности сервиса.',
    keywords: ['dot', 'status', 'indicator'],
    source: sfc(`defineProps<{
  serviceName: string
  serviceTone: string
}>()

definePreviewProps({
  serviceName: 'Check-in online',
  serviceTone: 'success',
})`, `  <Flex direction="row" align="center" gap="8px" p="12px">
    <Dot :tone="serviceTone" />
    <Text>{{ serviceName }}</Text>
  </Flex>`),
  },
  {
    id: 'example-box',
    tag: 'Box',
    title: 'Box · Route card',
    description: 'Контейнер, группирующий данные маршрута.',
    keywords: ['box', 'container', 'route'],
    source: sfc(`defineProps<{
  route: string
  aircraft: string
}>()

definePreviewProps({
  route: 'Moscow → Saint Petersburg',
  aircraft: 'Airbus A320',
})`, `  <Flex direction="column" gap="8px" p="12px">
    <Box p="12px">
      <Flex direction="column" gap="6px">
        <Text>{{ route }}</Text>
        <Text>{{ aircraft }}</Text>
      </Flex>
    </Box>
  </Flex>`),
  },
  {
    id: 'example-flex-row',
    tag: 'Flex',
    title: 'Flex · Horizontal toolbar',
    description: 'Горизонтальное распределение элементов по ширине.',
    keywords: ['flex', 'row', 'toolbar'],
    source: sfc(`defineProps<{
  sectionTitle: string
  actionLabel: string
}>()

definePreviewProps({
  sectionTitle: 'Passenger details',
  actionLabel: 'Edit',
})`, `  <Flex direction="row" align="center" justify="space-between" gap="12px" p="12px">
    <Text>{{ sectionTitle }}</Text>
    <Badge>{{ actionLabel }}</Badge>
  </Flex>`),
  },
  {
    id: 'example-flex-column',
    tag: 'Flex',
    title: 'Flex · Vertical stack',
    description: 'Вертикальный стек связанных значений.',
    keywords: ['flex', 'column', 'stack'],
    source: sfc(`defineProps<{
  airportCode: string
  airportName: string
}>()

definePreviewProps({
  airportCode: 'SVO',
  airportName: 'Sheremetyevo International Airport',
})`, `  <Flex direction="column" gap="6px" p="12px">
    <Text>{{ airportCode }}</Text>
    <Text>{{ airportName }}</Text>
  </Flex>`),
  },
  {
    id: 'example-grid',
    tag: 'Grid',
    title: 'Grid · Flight summary',
    description: 'Карточка на двенадцатиколоночной сетке.',
    keywords: ['grid', 'columns', 'layout'],
    source: sfc(`defineProps<{
  flightNumber: string
  route: string
  status: string
}>()

definePreviewProps({
  flightNumber: 'SU 1402',
  route: 'SVO → LED',
  status: 'On time',
})`, `  <Grid columns="12" gap="8px" p="12px" autoRows="28px">
    <Text colStart="1" colSpan="4" rowStart="1" rowSpan="1">{{ flightNumber }}</Text>
    <Text colStart="5" colSpan="5" rowStart="1" rowSpan="1">{{ route }}</Text>
    <Badge colStart="10" colSpan="3" rowStart="1" rowSpan="1">{{ status }}</Badge>
  </Grid>`),
  },
  {
    id: 'example-divider',
    tag: 'Divider',
    title: 'Divider · Details sections',
    description: 'Разделитель между двумя смысловыми блоками.',
    keywords: ['divider', 'separator', 'sections'],
    source: sfc(`defineProps<{
  primaryInfo: string
  secondaryInfo: string
}>()

definePreviewProps({
  primaryInfo: 'Gate D14',
  secondaryInfo: 'Boarding closes at 16:25',
})`, `  <Flex direction="column" gap="10px" p="12px">
    <Text>{{ primaryInfo }}</Text>
    <Divider />
    <Text>{{ secondaryInfo }}</Text>
  </Flex>`),
  },
  {
    id: 'example-input',
    tag: 'Input',
    title: 'Input · Passenger name',
    description: 'Display-only строковое поле с preview value.',
    keywords: ['input', 'field', 'name'],
    source: sfc(`defineProps<{
  fieldLabel: string
  passengerName: string
  placeholder: string
}>()

definePreviewProps({
  fieldLabel: 'Passenger name',
  passengerName: 'Alex Morgan',
  placeholder: 'Enter a full name',
})`, `  <Flex direction="column" gap="6px" p="12px">
    <Text>{{ fieldLabel }}</Text>
    <Input :value="passengerName" :placeholder="placeholder" />
  </Flex>`),
  },
  {
    id: 'example-textarea',
    tag: 'Textarea',
    title: 'Textarea · Travel note',
    description: 'Многострочная заметка, заполненная preview props.',
    keywords: ['textarea', 'note', 'multiline'],
    source: sfc(`defineProps<{
  fieldLabel: string
  travelNote: string
  placeholder: string
}>()

definePreviewProps({
  fieldLabel: 'Special request',
  travelNote: 'Window seat, if available.',
  placeholder: 'Add a note',
})`, `  <Flex direction="column" gap="6px" p="12px">
    <Text>{{ fieldLabel }}</Text>
    <Textarea :value="travelNote" :placeholder="placeholder" />
  </Flex>`),
  },
  {
    id: 'example-checkbox',
    tag: 'Checkbox',
    title: 'Checkbox · Notifications',
    description: 'Булево preview-значение с динамической подписью.',
    keywords: ['checkbox', 'boolean', 'notification'],
    source: sfc(`defineProps<{
  notificationsEnabled: boolean
  notificationsLabel: string
}>()

definePreviewProps({
  notificationsEnabled: true,
  notificationsLabel: 'Send flight updates',
})`, `  <Flex direction="column" gap="8px" p="12px">
    <Text>Notifications</Text>
    <Checkbox :checked="notificationsEnabled" :label="notificationsLabel" />
  </Flex>`),
  },
  {
    id: 'example-select',
    tag: 'Select',
    title: 'Select · Cabin class',
    description: 'Выбранное значение и варианты из preview props.',
    keywords: ['select', 'options', 'choice'],
    source: sfc(`defineProps<{
  fieldLabel: string
  cabinClass: string
  cabinOptions: Array<{ label: string; value: string }>
}>()

definePreviewProps({
  fieldLabel: 'Cabin class',
  cabinClass: 'business',
  cabinOptions: [
    { label: 'Economy', value: 'economy' },
    { label: 'Business', value: 'business' },
  ],
})`, `  <Flex direction="column" gap="6px" p="12px">
    <Text>{{ fieldLabel }}</Text>
    <Select :value="cabinClass" :options="cabinOptions" />
  </Flex>`),
  },
]
