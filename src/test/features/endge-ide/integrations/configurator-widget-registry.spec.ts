import type { IntegrationContext } from '@endge/integration-api'

import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'

import {
  getLayoutState,
  getWidget,
  getWidgetInstances,
  unregisterAllWidgets,
} from '@/components/layouts/grid/layout'
import { ConfiguratorWidgetRegistry } from '@/features/endge-ide/model/integrations/configurator-widget-registry'

const context: IntegrationContext = {
  integrationId: -1,
  integrationIdentity: 'test-hello-world',
  version: '0.1.0-dev',
  workspaceId: 'test-workspace',
}

describe('configurator widget registry', () => {
  afterEach(() => {
    unregisterAllWidgets()
  })

  it('registers an integration widget as a minimized floating singleton', async () => {
    const registry = new ConfiguratorWidgetRegistry()
    const visual = defineComponent({ template: '<p>Hello</p>' })
    const dispose = registry.register(context, {
      id: 'hello-world',
      title: 'Тестовый виджет',
      icon: 'MessageCircle',
      placement: 'sidebar',
      visual,
    })

    const id = 'integration:test-hello-world:hello-world'
    const widget = getWidget(id)

    expect(widget).toMatchObject({
      id,
      title: 'Тестовый виджет',
      icon: 'MessageCircle',
      position: 'floating',
      singleton: true,
    })
    expect(getWidgetInstances(id)).toHaveLength(1)
    expect(getLayoutState().widgets.value.areas.floating.states[id]?.minimized).toBe(true)

    await dispose()
    expect(getWidget(id)).toBeNull()
  })

  it('rejects slots that are not implemented yet', () => {
    const registry = new ConfiguratorWidgetRegistry()

    expect(() => registry.register(context, {
      id: 'toolbar-widget',
      title: 'Toolbar widget',
      placement: 'toolbar',
      visual: defineComponent({ template: '<p>Toolbar</p>' }),
    })).toThrow('Widget placement "toolbar" is not supported yet')
  })
})
