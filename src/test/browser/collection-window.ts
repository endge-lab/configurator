import type {
  ComponentSFCRuntimeHost,
  ControllerRuntimeHost,
} from '@endge/core'
import { Endge } from '@endge/core'
import { Raph } from '@raphy-js/raph'
import { createApp, defineAsyncComponent, defineComponent, h, ref } from 'vue'
import { Configurator } from '@/app/Configurator'
import ControllerCatalog from '@/features/endge-ide/ui/components/ControllerCatalog.vue'
import EndgeAdapterRoot from '@/features/endge-ide/ui/runtime/EndgeAdapterRoot'
import ControllerRuntimePreview from '@/features/endge-ide/ui/section/runtime-preview/ControllerRuntimePreview.vue'
import { i18n } from '@/i18n'
import { collectionWindowBundle } from './collection-window-documents'
import '@/assets/main.css'
import '@endge/ui-vue/vue.css'

void Configurator // Register application adapters before boot.
const errors: string[] = []
const SourceAcceptance = defineAsyncComponent(() => import('./collection-window-source').then(module => module.CollectionWindowSourceAcceptance))
async function main(): Promise<void> {
  if (!Raph.configured) {
    Raph.configure({ mode: 'runtime' })
  }
  Endge.context.configurePersistence({ context: 'disabled' })
  const params = new URLSearchParams(location.search)
  const storage = params.get('cache')
  const bundle = collectionWindowBundle(location.origin, {
    ...(params.has('prefetchRows') ? { prefetchRows: Number(params.get('prefetchRows')) } : {}),
    ...(storage === 'memory' || storage === 'indexeddb'
      ? { cache: {
          key: params.get('cacheKey') ?? 'fixture-pages-v1',
          storage,
          strategy: params.get('strategy') === 'stale-while-revalidate' ? 'stale-while-revalidate' : params.get('strategy') === 'network-first' ? 'network-first' : 'cache-first',
          maxAgeMs: Number(params.get('maxAgeMs') ?? 60000),
          maxStaleMs: Number(params.get('maxStaleMs') ?? 600000),
          onError: params.get('onError') === 'use-cache' ? 'use-cache' : 'fail',
          maxEntries: 50,
          maxBytes: 8388608,
        } }
      : {}),
    ...(params.has('retention') ? { retention: { beforeRows: 40, afterRows: 80 } } : {}),
  })
  await Endge.boot({
    dataProvider: 'bundle',
    bundleSource: bundle,
    scope: { workspaceIdentity: 'collection-window-fixture' },
    vars: {},
    ui: { adapterFallbackIds: ['vue-native'] },
  })
  for (const artifact of Endge.program.getArtifacts()) {
    if (artifact.status === 'error') {
      throw new Error(JSON.stringify(artifact.diagnostics))
    }
  }
  const removeProgramOnly = Endge.runtime.controllers.define({
    identity: 'fixture.program-only',
    displayName: 'Program-only diagnostic controller',
    origin: { kind: 'local', owner: 'fixture' },
    catalogPath: ['Fixture'],
    defaultProviderKey: 'fixture.unavailable-provider',
    contract: { props: [], outputs: [], commands: {}, dependencies: {} },
  })
  const programOnlyArtifact = Endge.compiler.buildController('fixture.program-only')
  removeProgramOnly()
  Endge.program.addArtifact(programOnlyArtifact) // Detached metadata, as in an imported bundle.
  const sessions = await Promise.all(
    ['cursor', 'offset'].map((paging, index) =>
      Endge.runtime.composition.mount(`window-${paging}`, {
        id: `fixture-${index}`,
      }),
    ),
  )
  const controllers = sessions.map(
    session => session.host.getChild('window') as ControllerRuntimeHost,
  )
  const screens = sessions.map(
    session => session.host.getChild('screen') as ComponentSFCRuntimeHost,
  )
  Object.assign(window, {
    collectionWindowFixture: {
      Endge,
      bundle,
      sessions,
      controllers,
      screens,
      errors,
    },
  })
  const Fixture = defineComponent({
    setup() {
      const revision = ref(0)
      const sourceOpen = ref(false)
      const unsubscribes = controllers.map(controller =>
        controller.subscribe(() => {
          revision.value += 1
        }),
      )
      const command = async (index: number, name: string, input?: unknown) => {
        try {
          await controllers[index]!.command(name, input)
        }
        catch (error) {
          errors.push(String(error))
          revision.value += 1
        }
      }
      const request = async (index: number, patch: Record<string, unknown>) => {
        const controller = controllers[index]!
        await controller.setProps({
          request: { ...(controller.getProps().request as object), ...patch },
        })
      }
      window.addEventListener(
        'pagehide',
        () => {
          unsubscribes.forEach(fn => fn())
          sessions.forEach(session => void session.unmount())
        },
        { once: true },
      )
      return () => {
        void revision.value
        return h(
          'main',
          { style: 'padding:24px;max-width:1400px;margin:auto' },
          [
            h(
              'h1',
              { style: 'font-size:24px;margin-bottom:12px' },
              'Collection window · cursor & offset',
            ),
            h(
              'p',
              'Scroll for automatic demand. Double-click a visible row to run table.scrollToRow(start) on that Table. Both windows own isolated Store state.',
            ),
            h('a', { href: '/__collection-window/requests', target: '_blank', rel: 'noopener', class: 'underline text-sm' }, 'Query request log (JSON)'),
            h(ControllerCatalog),
            h(
              'div',
              { style: 'display:grid;grid-template-columns:1fr 1fr;gap:24px' },
              controllers.map((controller, index) => {
                const out = controller.getOutputs()
                return h('section', { 'data-window': index }, [
                  h(
                    'h2',
                    { style: 'font-size:20px;margin:12px 0' },
                    index === 0 ? 'Cursor window' : 'Offset window',
                  ),
                  h(
                    'div',
                    {
                      style:
                        'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px',
                    },
                    [
                      ...['loadBefore', 'loadAfter', 'retry', 'reset', 'refresh', 'clearCache'].map(
                        name =>
                          h(
                            'button',
                            {
                              'data-command': name,
                              'onClick': () => command(index, name),
                              'class': 'border rounded px-2 py-1',
                            },
                            name,
                          ),
                      ),
                      h(
                        'button',
                        {
                          'data-control': 'retain',
                          'onClick': () =>
                            command(index, 'retainRows', {
                              keys: [(out.rows as { id: string }[])?.[0]?.id],
                            }),
                          'class': 'border rounded px-2 py-1',
                        },
                        'Retain first',
                      ),
                      h(
                        'button',
                        {
                          'data-control': 'release',
                          'onClick': () =>
                            command(index, 'releaseRows', {
                              keys: Array.from({ length: 500 }, (_, n) =>
                                String(n)),
                            }),
                          'class': 'border rounded px-2 py-1',
                        },
                        'Release all',
                      ),
                      h('label', [
                        'Filter ',
                        h(
                          'select',
                          {
                            'data-control': 'filter',
                            'onChange': (event: Event) =>
                              request(index, {
                                filter: (event.target as HTMLSelectElement)
                                  .value,
                              }),
                          },
                          ['all', 'blue', 'green'].map(value =>
                            h('option', { value }, value),
                          ),
                        ),
                      ]),
                      h('label', [
                        'Delay ',
                        h('input', {
                          'data-control': 'delay',
                          'type': 'number',
                          'min': 0,
                          'defaultValue': 0,
                          'style': 'width:70px',
                          'onChange': (event: Event) =>
                            request(index, {
                              delay: Number(
                                (event.target as HTMLInputElement).value,
                              ),
                            }),
                        }),
                      ]),
                      h('label', [
                        h('input', {
                          'data-control': 'fail',
                          'type': 'checkbox',
                          'onChange': (event: Event) =>
                            request(index, {
                              fail: (event.target as HTMLInputElement).checked,
                            }),
                        }),
                        ' Fail requests',
                      ]),
                      h('label', [
                        'Cap ',
                        h('input', {
                          'data-control': 'cap',
                          'type': 'number',
                          'min': 1,
                          'defaultValue': 80,
                          'style': 'width:70px',
                          'onChange': (event: Event) =>
                            controller.setProps({
                              maxLoadedRows: Number(
                                (event.target as HTMLInputElement).value,
                              ),
                            }),
                        }),
                      ]),
                    ],
                  ),
                  h('details', { 'data-controller-inspection': '' }, [h('summary', 'Controller inspection'), h(ControllerRuntimePreview, { runtime: controller })]),
                  h(EndgeAdapterRoot, {
                    rootKey: 'sfc-runtime',
                    host: screens[index],
                    input: screens[index]!.getInputSource() ?? {
                      kind: 'local',
                      props: {},
                    },
                  }),
                  h(
                    'pre',
                    {
                      'data-status': '',
                      'style':
                        'font-size:12px;padding:12px;white-space:pre-wrap',
                    },
                    JSON.stringify(
                      {
                        status: controller.status,
                        rowsRevision: out.rowsRevision,
                        loadedRowCount: out.loadedRowCount,
                        first: (out.rows as { id: string }[])?.[0]?.id,
                        last: (out.rows as { id: string }[])?.at(-1)?.id,
                        loading: out.loading,
                        error: out.error,
                        overLimit: out.overLimit,
                        refreshPending: out.refreshPending,
                        cacheStatus: out.cacheStatus,
                        hasBefore: out.hasBefore,
                        hasAfter: out.hasAfter,
                      },
                      null,
                      2,
                    ),
                  ),
                ])
              }),
            ),
            h('details', { 'data-source-acceptance': '', 'onToggle': (event: Event) => { sourceOpen.value = (event.target as HTMLDetailsElement).open } }, [
              h('summary', { class: 'cursor-pointer py-3 font-medium' }, 'Composition Source acceptance'),
              ...(sourceOpen.value ? [h(SourceAcceptance, { initialSource: String((bundle.documents.compositions[0] as { source: string }).source) })] : []),
            ]),
            h('pre', { 'data-errors': '' }, errors.join('\n')),
          ],
        )
      }
    },
  })
  createApp(Fixture).use(i18n).mount('#app')
  document.body.dataset.ready = 'true'
}
main().catch((error) => {
  errors.push(String(error))
  document.body.dataset.error = String(error)
  console.error(error)
})
