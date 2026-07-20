<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text, style/max-statements-per-line */
import type { ScriptEditorExtension } from '@/features/endge-ide/source-editor/adapters/monaco/script-editor-extension.types'
import type { SourceFormatLanguage } from '@/features/endge-ide/tools/format-source'

import { AlignLeft } from 'lucide-vue-next'
import * as monaco from 'monaco-editor'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { formatSource } from '@/features/endge-ide/tools/format-source'
import { resolveEditorSurfaceColor } from '@/features/endge-ide/tools/source-editor/editor-surface-theme'

type EditorLanguage = 'typescript' | 'javascript' | 'html' | 'css' | 'json' | 'plaintext'

const props = withDefaults(
  defineProps<{
    modelValue: string
    language?: EditorLanguage
    formatLanguage?: SourceFormatLanguage
    themeDark?: boolean
    minHeight?: number | string
    showToolbar?: boolean
    readOnly?: boolean
    extensions?: readonly ScriptEditorExtension[]
  }>(),
  {
    language: 'typescript',
    themeDark: true,
    minHeight: 600,
    showToolbar: false,
    readOnly: false,
    extensions: () => [],
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'blur'): void
  (e: 'format'): void
}>()

const container = ref<HTMLDivElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let extensionDisposables: monaco.IDisposable[] = []

const editorMinHeight = computed(() => {
  if (typeof props.minHeight === 'number') { return `${props.minHeight}px` }

  return props.minHeight
})

function createPalenightTheme(): monaco.editor.IStandaloneThemeData {
  return {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'bfc7d5', background: resolveEditorSurfaceColor().slice(1) },
      { token: 'keyword', foreground: 'c792ea' },
      { token: 'identifier', foreground: 'f07178' },
      { token: 'number', foreground: 'ffcb6b' },
      { token: 'string', foreground: 'c3e88d' },
      { token: 'comment', foreground: '717cb4', fontStyle: 'italic' },
    ],
    colors: {
      'editor.background': resolveEditorSurfaceColor(),
      'editor.foreground': '#bfc7d5',
      'editor.lineHighlightBackground': '#1c2b44',
      'editorCursor.foreground': '#ffcc00',
      'editorWhitespace.foreground': '#334155',
      'editorIndentGuide.background': '#334155',
      'editorLineNumber.foreground': '#64748b',
    },
  }
}

async function formatDocument(): Promise<void> {
  if (!editor) { return }

  const model = editor.getModel()
  const formatLanguage = props.formatLanguage ?? (
    props.language === 'plaintext' ? null : props.language
  )

  if (!model || !formatLanguage) {
    await editor.getAction('editor.action.formatDocument')?.run()
    return
  }

  try {
    const formatted = await formatSource(model.getValue(), formatLanguage)
    if (formatted !== model.getValue()) {
      editor.pushUndoStop()
      editor.executeEdits('format-document', [{
        range: model.getFullModelRange(),
        text: formatted,
        forceMoveMarkers: true,
      }])
      editor.pushUndoStop()
    }
    emit('format')
  }
  catch (error) {
    console.error(`[ScriptEditor] Failed to format ${formatLanguage} document`, error)
  }
}

defineExpose({ formatDocument })

onMounted(() => {
  monaco.editor.defineTheme('palenight', createPalenightTheme())

  if (container.value) {
    editor = monaco.editor.create(container.value, {
      value: props.modelValue,
      language: props.language || 'typescript',
      theme: props.themeDark ? 'palenight' : 'vs-light',
      minimap: { enabled: false },
      automaticLayout: true,
      fontSize: 14,
      tabSize: 2,
      insertSpaces: true,
      readOnly: props.readOnly,
      formatOnPaste: true,
      formatOnType: true,
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      autoClosingOvertype: 'always',
      autoIndent: 'full',
      scrollBeyondLastLine: false,
      wordWrap: 'on',
    })

    editor.onDidChangeModelContent(() => {
      emit('update:modelValue', editor!.getValue())
    })

    editor.onDidBlurEditorText(() => {
      emit('blur')
    })

    const model = editor.getModel()
    if (model) {
      extensionDisposables = props.extensions.flatMap((extension) => {
        try {
          const disposable = extension.install({ monaco, editor: editor!, model })
          return disposable ? [disposable] : []
        }
        catch (error) {
          console.error(`[ScriptEditor] Failed to install extension "${extension.id}"`, error)
          return []
        }
      })
    }
  }
})

watch(
  () => props.modelValue,
  (newValue) => {
    if (editor && editor.getValue() !== newValue) {
      editor.setValue(newValue)
    }
  },
)

watch(
  () => props.themeDark,
  (dark) => {
    if (editor) {
      monaco.editor.setTheme(dark ? 'palenight' : 'vs-light')
    }
  },
)

watch(
  () => props.language,
  (language) => {
    const model = editor?.getModel()
    if (model) { monaco.editor.setModelLanguage(model, language) }
  },
)

watch(
  () => props.readOnly,
  (readOnly) => {
    editor?.updateOptions({ readOnly })
  },
)

onBeforeUnmount(() => {
  extensionDisposables.forEach(disposable => disposable.dispose())
  extensionDisposables = []
  editor?.dispose()
})
</script>

<template>
  <div
    class="editor-wrapper"
    :class="{ 'editor-wrapper--framed': showToolbar }"
  >
    <div v-if="showToolbar" class="editor-toolbar">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="editor-toolbar-button"
        @click="formatDocument"
      >
        <AlignLeft class="size-4" />
        Форматировать
      </Button>
    </div>
    <div ref="container" class="editor" />
  </div>
</template>

<style scoped>
.editor-wrapper {
  height: 100%;
  min-height: v-bind(editorMinHeight);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-wrapper--framed {
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: var(--editor-surface);
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 40px;
  padding: 4px 8px;
  border-bottom: 1px solid rgb(255 255 255 / 8%);
  background: color-mix(in srgb, var(--editor-surface), white 5%);
}

.editor-toolbar-button {
  gap: 6px;
  color: #d7deea;
}

.editor {
  width: 100%;
  min-height: 0;
  flex: 1;
}

:deep(.endge-sfc-column-action) {
  margin-left: 32px;
  color: #8790a8 !important;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer !important;
  user-select: none;
  transition: color 120ms ease;
}

:deep(.endge-sfc-column-action:hover) {
  color: #c792ea !important;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}
</style>
