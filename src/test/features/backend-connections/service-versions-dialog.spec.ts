import type { BackendVersionState } from '@/features/backend-connections/domain/types/backend-version.type'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import { renderToString } from 'vue/server-renderer'

import Dialog from '@/features/backend-connections/ui/ServiceVersions_Dialog.vue'
import ru from '@/i18n/locales/ru.json'

const fixture = vi.hoisted(() => ({ states: {} as Record<string, BackendVersionState> }))
vi.mock('@/app/Configurator', () => ({ Configurator: { connections: { readWorkspaceFor: () => null } } }))
vi.mock('@/features/backend-connections/ui/use-backend-connections', () => ({
  useBackendConnections: () => ({ catalog: { value: { items: [
    { id: 'one', name: 'Первое', baseUrl: 'http://first.test' },
    { id: 'two', name: 'Второе', baseUrl: 'http://second.test' },
  ] } } }),
}))
vi.mock('@/features/backend-connections/ui/use-backend-versions', () => ({
  useBackendVersions: () => ({ state: (url: string) => fixture.states[url], refreshMany: vi.fn() }),
}))
vi.mock('@/features/domain-version/ui/use-domain-versions', () => ({
  useDomainVersions: () => ({ state: () => undefined, refreshMany: vi.fn() }),
}))
vi.mock('@/features/domain-version/ui/DomainVersionBadge.vue', () => ({ default: () => null }))
vi.mock('@/components/ui/dialog', async () => {
  const { defineComponent, h } = await import('vue')
  const Wrapper = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
  return { Dialog: Wrapper, DialogContent: Wrapper, DialogHeader: Wrapper, DialogTitle: Wrapper }
})
vi.mock('@/components/ui/tooltip', async () => {
  const { defineComponent, h } = await import('vue')
  const Wrapper = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
  return { Tooltip: Wrapper, TooltipContent: Wrapper, TooltipProvider: Wrapper, TooltipTrigger: Wrapper }
})
async function render(): Promise<string> {
  const app = createSSRApp(defineComponent({ setup: () => () => h(Dialog) }))
  app.use(createI18n({ legacy: false, locale: 'ru', messages: { ru } }))
  return renderToString(app)
}
function ready(services: Array<{ service: string, status: 'available' | 'unavailable', version?: string }>): BackendVersionState {
  return { status: 'ready', loadedAt: 0, value: { service: 'backend', version: '0.11.0', env: 'test', services } }
}
describe('mock Generator в диалоге версий', () => {
  beforeEach(() => {
    vi.stubGlobal('__APP_VERSION__', 'test')
  })
  it('сохраняет строку в каждой среде при старом и недоступном backend', async () => {
    fixture.states['http://first.test'] = ready([{ service: 'service_ai_workbench', status: 'available', version: '0.6.0' }])
    fixture.states['http://second.test'] = { status: 'error', code: 'offline', message: 'offline', loadedAt: 0 }
    const html = await render()
    expect(html.match(/Mock Generator/g)).toHaveLength(2)
    expect(html).toContain('AI Workbench')
    expect(html).toContain('v0.6.0')
    expect(html.match(/aria-label="Недоступен"/g)).toHaveLength(3)
  })
  it('показывает версию доступного Mock и загрузку другой среды', async () => {
    fixture.states['http://first.test'] = ready([{ service: 'service_mock_generator', status: 'available', version: '0.1.0' }])
    fixture.states['http://second.test'] = { status: 'loading' }
    const html = await render()
    expect(html.match(/Mock Generator/g)).toHaveLength(2)
    expect(html).toContain('v0.1.0')
    expect(html.match(/aria-label="Загрузка…"/g)).toHaveLength(2)
  })
})
