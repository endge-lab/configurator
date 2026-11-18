import type { ControllerRuntimeHost } from '@endge/core'
import type { CompositionDependencyTreeResult } from '@/features/endge-ide/services/composition-dependencies/composition-dependency-tree'
import { Endge } from '@endge/core'
import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue'
import { Configurator } from '@/app/Configurator'
import { BackendConnectionStorage } from '@/features/backend-connections/services/backend-connection-storage'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import { buildCompositionDependencyTree } from '@/features/endge-ide/services/composition-dependencies/composition-dependency-tree'
import {
  CompositionPreviewSession,
  createPreviewComposition,
} from '@/features/endge-ide/services/composition-preview/composition-preview-state'
import { compilePreviewSource } from '@/features/endge-ide/services/source-preview/compile-preview-source'
import { formatSource } from '@/features/endge-ide/tools/format-source'
import CompositionSourceEditor from '@/features/endge-ide/ui/components/CompositionSourceEditor.vue'
import DocumentDependencyTreeNode from '@/features/endge-ide/ui/components/document-dependencies/DocumentDependencyTreeNode.vue'
import ControllerRuntimePreview from '@/features/endge-ide/ui/section/runtime-preview/ControllerRuntimePreview.vue'
import RuntimePreviewRenderable from '@/features/endge-ide/ui/section/runtime-preview/RuntimePreviewRenderable.vue'
import '@/features/endge-ide/source-editor/adapters/monaco/configure-monaco-workers'

const IDENTITY = 'fixture-source-preview'

// Test-only composition root: use the real editor and Preview owner, no backend IDE initialization.
export const CollectionWindowSourceAcceptance = defineComponent({
  props: { initialSource: { type: String, required: true } },
  setup(props) {
    // IDE construction needs a selected transport address; no IDE modules are started or fetched.
    const backendStorage = new BackendConnectionStorage()
    const previousBackend = backendStorage.readActiveBackend()
    backendStorage.writeActiveBackend(location.origin)
    try {
      EndgeIDE.setup(Configurator.context)
    }
    finally {
      // Construction is the only point needing this address. Restore it immediately,
      // including when setup fails, so closing/reopening never overwrites user state.
      if (previousBackend) {
        backendStorage.writeActiveBackend(previousBackend)
      }
      else {
        backendStorage.removeActiveBackend()
      }
    }
    const preview = new CompositionPreviewSession()
    const source = ref(props.initialSource)
    const validSource = ref(props.initialSource)
    const ready = ref(false)
    const busy = ref(false)
    const status = ref('Not compiled')
    const diagnostics = ref<unknown[]>([])
    const dependencyTree = ref<CompositionDependencyTreeResult | null>(null)
    const error = ref('')
    let disposed = false
    const controller = computed(
      () =>
        preview.runtime.value?.getChild(
          'window',
        ) as ControllerRuntimeHost | null,
    )
    const compile = () => {
      error.value = ''
      const syntax = compilePreviewSource('composition', source.value)
      dependencyTree.value = buildCompositionDependencyTree({
        identity: IDENTITY,
        source: source.value,
      })
      if (!syntax.artifact) {
        diagnostics.value = syntax.diagnostics ?? []
        status.value = 'error'
        return false
      }
      const artifact = Endge.compiler.buildComposition(
        createPreviewComposition({ identity: IDENTITY, source: source.value }),
      )
      diagnostics.value = artifact.diagnostics
      status.value = artifact.status === 'error' ? 'error' : 'valid'
      return status.value === 'valid'
    }
    const launch = async () => {
      if (!compile()) {
        return
      }
      busy.value = true
      try {
        await preview.launch({ identity: IDENTITY, source: source.value })
      }
      catch (value) {
        error.value = value instanceof Error ? value.message : String(value)
      }
      finally {
        busy.value = false
      }
    }
    const stop = async () => {
      await preview.dispose()
    }
    const setSample = (
      kind: 'valid' | 'command' | 'dependency' | 'completion',
    ) => {
      source.value
        = kind === 'completion'
          ? 'defineComposition({runtimes:{window:controller(\'endge.'
          : kind === 'command'
            ? validSource.value.replace('\'setViewport\'', '\'notACommand\'')
            : kind === 'dependency'
              ? validSource.value.replace(
                  '\'window-commit\'',
                  '\'missing-window-commit\'',
                )
              : validSource.value
      status.value = 'Not compiled'
      diagnostics.value = []
      error.value = ''
    }
    onMounted(async () => {
      const formatted = await formatSource(props.initialSource, 'typescript')
      if (disposed) {
        return
      }
      validSource.value = formatted
      if (source.value === props.initialSource) {
        source.value = formatted
      }
      ready.value = true
    })
    onBeforeUnmount(() => {
      disposed = true
      void preview.dispose().finally(() => EndgeIDE.reset())
    })
    const button = (text: string, control: string, action: () => unknown) =>
      h(
        'button',
        {
          'data-source-control': control,
          'class': 'rounded border px-2 py-1',
          'disabled': busy.value,
          'onClick': action,
        },
        text,
      )
    return () =>
      h(
        'section',
        {
          'data-source-panel': '',
          'data-source-ready': String(ready.value),
          'class': 'space-y-3 rounded border p-3',
        },
        [
          h(
            'p',
            'Test-only draft. This is the actual CompositionSourceEditor, linked Compiler, dependency tree and CompositionPreviewSession. No Domain save is performed.',
          ),
          h(
            'p',
            'Completion sample: focus editor, Cmd/Ctrl+End, then Ctrl+Space. Restore valid draft before compiling or previewing.',
          ),
          h('div', { class: 'flex flex-wrap gap-2' }, [
            button('Restore valid draft', 'valid', () => setSample('valid')),
            button('Completion sample', 'completion', () =>
              setSample('completion')),
            button('Invalid command', 'command', () => setSample('command')),
            button('Invalid dependency', 'dependency', () =>
              setSample('dependency')),
            button('Compile linked draft', 'compile', compile),
            button('Preview draft', 'preview', launch),
            button('Stop Preview', 'stop', stop),
          ]),
          h(
            'div',
            {
              'data-source-editor': '',
              'style': 'height:420px;min-height:420px',
            },
            [
              h(CompositionSourceEditor, {
                'modelValue': source.value,
                'ownerIdentity': IDENTITY,
                'onUpdate:modelValue': (value: string) => {
                  source.value = value
                },
              }),
            ],
          ),
          h(
            'p',
            { 'data-source-status': '', 'role': 'status' },
            `Compile: ${status.value}`,
          ),
          h(
            'pre',
            {
              'data-source-diagnostics': '',
              'class': 'overflow-auto whitespace-pre-wrap text-xs',
            },
            JSON.stringify(diagnostics.value, null, 2),
          ),
          h(
            'div',
            { 'data-source-dependencies': '' },
            dependencyTree.value?.root
              ? [
                  h(DocumentDependencyTreeNode, {
                    node: dependencyTree.value.root,
                    root: true,
                  }),
                ]
              : [],
          ),
          h('p', { 'data-source-error': '', 'role': 'alert' }, error.value),
          h(
            'div',
            {
              'data-source-preview': '',
              'data-runtime-id': preview.runtime.value?.id ?? '',
            },
            [
              ...preview.renderables.value.map(item =>
                h(RuntimePreviewRenderable, { key: item.key, item }),
              ),
              ...(controller.value
                ? [h(ControllerRuntimePreview, { runtime: controller.value })]
                : []),
            ],
          ),
        ],
      )
  },
})
