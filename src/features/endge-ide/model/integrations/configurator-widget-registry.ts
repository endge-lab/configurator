import type {
  ConfiguratorWidget,
  IntegrationContext,
  IntegrationDisposer,
} from '@endge/integration-api'
import type { Component } from 'vue'

import { defineAsyncComponent, markRaw } from 'vue'

import {
  createWidgetInstance,
  getWidget,
  hideWidget,
  registerWidget,
  unregisterWidget,
} from '@/components/layouts/grid/layout'

function resolveVisual(visual: unknown): Component {
  if (typeof visual === 'function') {
    return markRaw(defineAsyncComponent(visual as () => Promise<{ default: Component }>))
  }
  if (visual && typeof visual === 'object') {
    return markRaw(visual as Component)
  }
  throw new Error('[ConfiguratorIntegrationHost] Widget visual must be a Vue component or loader.')
}

/** Adapts the public integration widget slot to the existing configurator grid. */
export class ConfiguratorWidgetRegistry {
  public register(
    context: IntegrationContext,
    widget: ConfiguratorWidget<unknown>,
  ): IntegrationDisposer {
    if (widget.placement !== 'sidebar') {
      throw new Error(
        `[ConfiguratorIntegrationHost] Widget placement "${widget.placement}" is not supported yet.`,
      )
    }

    const id = `integration:${context.integrationIdentity}:${widget.id}`
    if (getWidget(id)) {
      throw new Error(`[ConfiguratorIntegrationHost] Widget "${id}" is already registered.`)
    }

    registerWidget({
      id,
      title: widget.title,
      icon: widget.icon || 'Puzzle',
      content: 'component',
      defaultComponent: resolveVisual(widget.visual),
      singleton: true,
      defaultPosition: 'floating',
      allowedPositions: ['floating'],
      floatingConstraints: {
        minWidth: 260,
        maxWidth: 520,
        minHeight: 140,
        maxHeight: 420,
        defaultWidth: 340,
        defaultHeight: 190,
      },
    })
    createWidgetInstance(id, {}, { activate: false })
    hideWidget(id)

    let disposed = false
    return () => {
      if (disposed) {
        return
      }
      disposed = true
      unregisterWidget(id)
    }
  }
}
