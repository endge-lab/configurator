<script setup lang="ts">
import { useUI } from '@endge/ui-vue'
import * as monaco from 'monaco-editor'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  applyEndgeMonacoTheme,
  ENDGE_MONACO_SCROLLBAR_OPTIONS,
} from '@/features/endge-ide/tools/source-editor/editor-surface-theme'

const props = defineProps<{ text: string }>()
const element = ref<HTMLElement | null>(null)
const ui = useUI()
let editor: monaco.editor.IStandaloneCodeEditor | undefined
let model: monaco.editor.ITextModel | undefined
onMounted(() => {
  model = monaco.editor.createModel(props.text, 'plaintext')
  editor = monaco.editor.create(element.value!, {
    model,
    readOnly: true,
    domReadOnly: true,
    automaticLayout: true,
    minimap: { enabled: false },
    scrollbar: ENDGE_MONACO_SCROLLBAR_OPTIONS,
    theme: applyEndgeMonacoTheme(monaco, ui.value.isDark),
  })
})
watch(
  () => props.text,
  value => model?.setValue(value),
)
watch(
  () => ui.value.isDark,
  value => applyEndgeMonacoTheme(monaco, value),
)
onBeforeUnmount(() => {
  editor?.dispose()
  model?.dispose()
})
</script>

<template>
  <div
    ref="element"
    class="h-full min-h-0"
    aria-label="Восстановлено из AST, только чтение"
  />
</template>
