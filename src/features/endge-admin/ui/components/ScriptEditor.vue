<script setup lang="ts">
import * as monaco from 'monaco-editor'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    language?: 'typescript'
    themeDark?: boolean
  }>(),
  { language: 'typescript', themeDark: true },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const container = ref<HTMLDivElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null

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
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      autoClosingOvertype: 'always',
      autoIndent: 'full',
    })

    editor.onDidChangeModelContent(() => {
      emit('update:modelValue', editor!.getValue())
    })
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

onBeforeUnmount(() => {
  editor?.dispose()
})
</script>

<template>
  <div class="editor-wrapper">
    <div ref="container" class="editor" />
  </div>
</template>

<style scoped>
.editor-wrapper {
  height: 100%;
}

.editor {
  width: 100%;
  height: 600px;
}
</style>
