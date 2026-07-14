<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text, style/max-statements-per-line */
import type { ScriptEditorExtension } from '@/features/endge-ide/source-editor/adapters/monaco/script-editor-extension.types'

import { AlignLeft } from 'lucide-vue-next'
import * as monaco from 'monaco-editor'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'

type EditorLanguage = 'typescript' | 'javascript' | 'html' | 'css' | 'json' | 'plaintext'

const props = withDefaults(
  defineProps<{
    modelValue: string
    language?: EditorLanguage
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

const palenightTheme: monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'bfc7d5', background: '292d3e' },
    { token: 'keyword', foreground: 'c792ea' },
    { token: 'identifier', foreground: 'f07178' },
    { token: 'number', foreground: 'ffcb6b' },
    { token: 'string', foreground: 'c3e88d' },
    { token: 'comment', foreground: '717cb4', fontStyle: 'italic' },
  ],
  colors: {
    'editor.background': '#292d3e',
    'editor.foreground': '#bfc7d5',
    'editor.lineHighlightBackground': '#2e3b4e',
    'editorCursor.foreground': '#ffcc00',
    'editorWhitespace.foreground': '#3b4048',
    'editorIndentGuide.background': '#3b4048',
    'editorLineNumber.foreground': '#546e7a',
  },
}

async function formatDocument(): Promise<void> {
  if (!editor) { return }

  await editor.getAction('editor.action.formatDocument')?.run()
  emit('format')
}

defineExpose({ formatDocument })

onMounted(() => {
  monaco.editor.defineTheme('palenight', palenightTheme)

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
  background: #292d3e;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 40px;
  padding: 4px 8px;
  border-bottom: 1px solid rgb(255 255 255 / 8%);
  background: #25293a;
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
</style>
