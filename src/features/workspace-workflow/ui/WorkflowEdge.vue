<script setup lang="ts">
import type { EdgeProps } from '@vue-flow/core'
import { BaseEdge, useVueFlow } from '@vue-flow/core'
import { computed } from 'vue'

import { routeWorkflowEdge } from '../tools/workflow-edge-route'

const props = defineProps<EdgeProps<{ resource: boolean }>>()
const { getNodes } = useVueFlow()
const path = computed(() => {
  const { sourceX, sourceY, targetX, targetY } = props
  const points = routeWorkflowEdge(
    { x: sourceX, y: sourceY },
    { x: targetX, y: targetY },
    props.source,
    props.target,
    props.data.resource,
    getNodes.value.filter(node => !node.hidden).map(node => ({ id: node.id, ...node.computedPosition, ...node.dimensions })),
  )
  let result = `M ${sourceX} ${sourceY}`
  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1]
    const point = points[index]
    const next = points[index + 1]
    const incoming = Math.hypot(point.x - previous.x, point.y - previous.y)
    const outgoing = Math.hypot(next.x - point.x, next.y - point.y)
    if (!incoming || !outgoing) {
      result += ` L ${point.x} ${point.y}`
      continue
    }
    const radius = Math.min(6, incoming / 2, outgoing / 2)
    const beforeX = point.x - (point.x - previous.x) * radius / incoming
    const beforeY = point.y - (point.y - previous.y) * radius / incoming
    const afterX = point.x + (next.x - point.x) * radius / outgoing
    const afterY = point.y + (next.y - point.y) * radius / outgoing
    result += ` L ${beforeX} ${beforeY} Q ${point.x} ${point.y} ${afterX} ${afterY}`
  }
  return `${result} L ${targetX} ${targetY}`
})
</script>

<template>
  <BaseEdge
    :id="id"
    :path="path"
    :style="style"
    :marker-end="markerEnd"
    :label="label"
    :label-x="targetX - 16"
    :label-y="targetY - 16"
    :label-style="labelStyle"
    :label-bg-style="labelBgStyle"
    :label-show-bg="labelShowBg"
  />
</template>
