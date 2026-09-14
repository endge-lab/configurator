/* eslint-disable perfectionist/sort-imports -- Register the same application plugins before resolving Core. */
import { Configurator } from '@/app/Configurator'
import { Endge } from '@endge/core'
import { createApp, defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { BackendConnectionStorage } from '@/features/backend-connections/services/backend-connection-storage'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import { createDefaultBuildProfileSettings } from '@/features/endge-ide/domain/entities/RBuildProfile'
import DebuggerPage from '@/features/remote-debugger/ui/Debugger_Page.vue'
import { startRuntimeInspectionClient } from './runtime-inspection-client'
import { i18n } from '@/i18n'
import '@/features/endge-ide/source-editor/adapters/monaco/configure-monaco-workers'
import '@/assets/main.css'
import '@endge/ui-vue-shadcn/vue-shadcn.css'
import '@endge/ui-vue/vue.css'

const role = new URLSearchParams(location.search).get('role') ?? 'debugger'
const server = 'http://127.0.0.1:4174'
new BackendConnectionStorage().writeActiveBackend(server)
EndgeIDE.setup(Configurator.context)
const errors: string[] = []
const inspectionFixture = { Endge, Configurator, EndgeIDE, errors }
Object.assign(window, { inspectionFixture })
async function main(): Promise<void> {
  if (role === 'debugger') {
    Endge.context.configurePersistence({ context: 'disabled' })
    await Endge.boot({
      mode: 'debugger',
      scope: { workspaceIdentity: 'inspection-fixture' },
      vars: {},
      bridge: { role: 'configurator', serverUrl: server, debug: true },
    })
    await EndgeIDE.init()
    Configurator.remoteDebugger.init()
    const app = createApp(DebuggerPage)
    app.use(i18n)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          component: DebuggerPage,
          meta: { layoutScope: 'debugger' },
        },
      ],
    })
    app.use(router)
    await router.isReady()
    app.mount('#app')
  }
  else {
    document.querySelector('#app')!.innerHTML
      = '<div id="build"></div><button data-consent>Разрешить отладку</button><button data-change>Изменить данные</button><button data-disconnect>Отключить</button><pre></pre>'
    await startRuntimeInspectionClient('inspection-fixture', server, {
      mountRuntime: role === 'client',
    })
    if (role === 'build') {
      const Build = defineComponent({
        setup() {
          const includeAst = ref(false)
          const fileFormat = ref<'gzip' | 'json'>('gzip')
          const busy = ref(false)
          const error = ref('')
          const build = async () => {
            busy.value = true
            try {
              await EndgeIDE.buildProfiles.buildAndDownload({
                ...createDefaultBuildProfileSettings(),
                includeAst: includeAst.value,
                fileFormat: fileFormat.value,
              })
            }
            catch (value) {
              error.value = String(value)
            }
            finally {
              busy.value = false
            }
          }
          return () =>
            h('section', { class: 'space-y-4 p-8' }, [
              h('h1', 'Сборка изолированной модели'),
              h(
                'select',
                {
                  'aria-label': 'Формат файла',
                  'value': fileFormat.value,
                  'onChange': (event: Event) => {
                    fileFormat.value = (event.target as HTMLSelectElement)
                      .value as 'gzip' | 'json'
                  },
                },
                [
                  h('option', { value: 'gzip' }, 'Бинарный, сжатый'),
                  h('option', { value: 'json' }, 'JSON, читаемый'),
                ],
              ),
              h('label', [
                h('input', {
                  type: 'checkbox',
                  checked: includeAst.value,
                  onChange: (event: Event) => {
                    includeAst.value = (
                      event.target as HTMLInputElement
                    ).checked
                  },
                }),
                'Включить AST',
              ]),
              h(
                'button',
                { onClick: build, disabled: busy.value },
                busy.value ? 'Сборка…' : 'Собрать и скачать',
              ),
              h('p', { role: 'alert' }, error.value),
            ])
        },
      })
      createApp(Build).mount('#build')
    }
  }
  document.body.dataset.ready = 'true'
}
main().catch((error) => {
  errors.push(String(error))
  document.body.dataset.error = String(error)
  console.error(error)
})
