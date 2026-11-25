import type { TimelineRecipeFill, TimelineRecipeIconShape } from '@endge/core'
import type { Component, CSSProperties } from 'vue'
import { h, render } from 'vue'

export function colorInputValue(color: string, fallback = '#478acf'): string {
  if (/^#[0-9a-f]{3,4}$/i.test(color)) {
    return `#${[...color.slice(1, 4)].map(char => char + char).join('')}`
  }
  return /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(color) ? color.slice(0, 7) : fallback
}

export function timelineRecipeFillStyle(fill: TimelineRecipeFill): CSSProperties {
  if (typeof fill === 'string') {
    return { backgroundColor: fill }
  }
  if (fill.type === 'stripe') {
    return {
      backgroundColor: fill.background,
      backgroundImage: `repeating-linear-gradient(${fill.angle + 90}deg, transparent 0 ${fill.width}px, ${fill.color} ${fill.width}px ${fill.width * 2}px)`,
    }
  }
  const angle = fill.angle * Math.PI / 180
  const dx = Math.cos(angle) * Math.SQRT1_2
  const dy = Math.sin(angle) * Math.SQRT1_2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="${0.5 - dx}" x2="${0.5 + dx}" y1="${0.5 - dy}" y2="${0.5 + dy}"><stop stop-color="${fill.from}"/><stop offset="1" stop-color="${fill.to}"/></linearGradient></defs><path fill="url(#fill)" d="M0 0H1V1H0Z"/></svg>`
  return { backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, backgroundSize: '100% 100%' }
}

export function readTimelineLucideShapes(icon: Component): TimelineRecipeIconShape[] {
  const container = document.createElement('div')
  try {
    render(h(icon), container)
    return Array.from(container.querySelector('svg')?.children ?? [], element => ({
      tag: element.localName as TimelineRecipeIconShape['tag'],
      attrs: Object.fromEntries(Array.from(element.attributes, attribute => [attribute.name, attribute.value])),
    }))
  }
  finally {
    render(null, container)
  }
}
