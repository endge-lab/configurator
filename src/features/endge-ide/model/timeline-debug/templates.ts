import type {
  GroupColumnHeader,
  GroupColumn,
  TimelineTask,
  Tooltip,
  TimelineCluster,
  TimelineGroupInput,
  TimelineTaskInput,
} from '@endge/timeline-chart'

function task<G extends TimelineGroupInput, T extends TimelineTaskInput>(
  ctx: TimelineTask<G, T>,
): NovaSchema {
  // Фон
  if (ctx.item.type === 'background') {
    return [
      {
        type: 'rect',
        x: ctx.x,
        y: 5 + ctx.y,
        width: ctx.width,
        height: ctx.group.innerHeight - 10,
        styles: {
          background: '#dbffea',
        },
      },
    ]
  }
  // Задача
  else {
    return [
      {
        type: 'rect',
        x: ctx.x,
        y: ctx.y,
        width: ctx.width,
        height: ctx.height,
        styles: {
          background:
            ctx.rowIndex === 0
              ? '#3fa776'
              : ctx.rowIndex === 1
                ? '#6e76da'
                : ctx.rowIndex === 2
                  ? '#40d9a3'
                  : '#ae4747',
        },
      },
      {
        type: 'text',
        text: `${ctx.item.displayName}`,
        x: ctx.x,
        y: ctx.y,
        width: ctx.width,
        height: ctx.height,
        styles: {
          color: '#ffffff',
          font: {
            size: 10,
          },
          ellipsis: true,
        },
      },
      {
        active: ctx.isSelected,
        type: 'border',
        x: ctx.x,
        y: ctx.y,
        width: ctx.width,
        height: ctx.height,
        styles: {
          color: '#1635ff',
          width: 3,
        },
      },
    ]
  }
}

const groupColumnHeader = <
  G extends TimelineGroupInput,
  T extends TimelineTaskInput,
>(
  ctx: GroupColumnHeader<G, T>,
): NovaSchema => [
  {
    type: 'text',
    text: ctx.column.title,
    x: ctx.x,
    y: ctx.y,
    width: ctx.width,
    height: ctx.height,
    styles: {
      color: 'white',
      ellipsis: true,
    },
  },
]

const groupColumn = <G extends TimelineGroupInput, T extends TimelineTaskInput>(
  ctx: GroupColumn<G, T>,
): NovaSchema => [
  {
    type: 'rect',
    x: ctx.x,
    y: ctx.y,
    width: ctx.width,
    height: ctx.height,
    styles: {
      background: 'lightblue',
    },
    active: ctx.group.isSelected,
  },
  {
    type: 'text',
    x: ctx.x,
    y: ctx.y,
    width: ctx.width,
    height: ctx.height,
    text: ctx.data,
    styles: {
      color: '#ABB2C0',
      ellipsis: true,
    },
  },
]

const tooltip = <G extends TimelineGroupInput, T extends TimelineTaskInput>(
  ctx: Tooltip<G, T>,
): NovaSchema => [
  {
    type: 'text-markdown',
    x: ctx.x,
    y: ctx.y,
    text: `${ctx.task.item.displayName}`,
    styles: {
      color: 'white',
    },
  },
]

const cluster = <G extends TimelineGroupInput, T extends TimelineTaskInput>(
  ctx: TimelineCluster<G, T>,
): NovaSchema => {
  return [
    {
      type: 'rect',
      x: ctx.x,
      y: ctx.y,
      width: ctx.width,
      height: ctx.height,
      styles: {
        background: '#104930',
      },
    },
    {
      type: 'text',
      text: `Кластер из ${ctx.tasks?.length} задач`,
      x: ctx.x,
      y: ctx.y,
      width: ctx.width,
      height: ctx.height,
      styles: {
        color: '#ffffff',
        font: {
          size: 10,
        },
        ellipsis: true,
      },
    },
  ]
}

export const TimelineChartTemplatesDebug = {
  task,
  cluster,
  groupColumnHeader,
  groupColumn,
  tooltip,
}
