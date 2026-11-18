import { registerTimelinePreset } from '@endge/ui-vue'

registerTimelinePreset({
  name: 'demo-resource-load',
  label: 'Пример загрузки ресурса',
  fields: {
    color: { type: 'color', label: 'Цвет полосы', default: '#478ACF' },
    labels: { type: 'boolean', label: 'Показывать номера рейсов', default: true },
  },
  compact: true,
}, {
  configure: ({ settings, collapsed }) => ({
    options: { tasks: { height: collapsed ? 10 : 22 } },
    taskProfiles: {
      defaultProfileId: 'load',
      profiles: {
        load: {
          recipe: {
            rects: [{
              id: 'load',
              x: c => c.x,
              y: c => c.y,
              width: c => c.width,
              height: c => c.height,
              color: String(settings.color),
              radius: 3,
            }],
            labels: settings.labels && !collapsed
              ? [{
                  text: c => String((c.item as { title?: string }).title ?? c.item.id),
                  x: c => c.x + 4,
                  y: c => c.y,
                  width: c => Math.max(0, c.width - 8),
                  height: c => c.height,
                  color: '#FFFFFF',
                  ellipsis: true,
                }]
              : [],
          },
        },
      },
    },
  }),
})
