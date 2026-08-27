import type { TimelineGroupInput, TimelineTaskInput } from '@endge/timeline-chart'

/** Группа diagnostics timeline с UI-названием. */
export interface TimelineDebugGroup extends TimelineGroupInput {
  displayName: string
}

/** Diagnostics span, отображаемый как range-задача timeline. */
export interface TimelineDebugTask extends TimelineTaskInput {
  displayName: string
}
