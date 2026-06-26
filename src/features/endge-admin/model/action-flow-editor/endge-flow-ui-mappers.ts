import type { EndgeFlowNodeKind } from '@endge/core'

export interface EndgeFlowUiMeta {
  icon: string
  badgeClass: string
}

const UI_META_BY_KIND: Record<EndgeFlowNodeKind, EndgeFlowUiMeta> = {
  start: {
    icon: 'play',
    badgeClass: 'bg-sky-100 text-sky-700',
  },
  action: {
    icon: 'zap',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  query: {
    icon: 'database',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  runtimeAction: {
    icon: 'play',
    badgeClass: 'bg-indigo-100 text-indigo-700',
  },
  watch: {
    icon: 'bell-ring',
    badgeClass: 'bg-yellow-100 text-yellow-700',
  },
  eventSubscribe: {
    icon: 'bell',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  delay: {
    icon: 'clock-3',
    badgeClass: 'bg-rose-100 text-rose-700',
  },
  timer: {
    icon: 'clock-3',
    badgeClass: 'bg-rose-100 text-rose-700',
  },
  intervalTimer: {
    icon: 'repeat',
    badgeClass: 'bg-violet-100 text-violet-700',
  },
  switch: {
    icon: 'git-branch',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  forEach: {
    icon: 'repeat',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  while: {
    icon: 'refresh-ccw',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  parallel: {
    icon: 'split',
    badgeClass: 'bg-indigo-100 text-indigo-700',
  },
}

export function getEndgeFlowUiMeta(kind: EndgeFlowNodeKind): EndgeFlowUiMeta {
  return UI_META_BY_KIND[kind]
}
