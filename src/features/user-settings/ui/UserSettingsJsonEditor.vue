<script setup lang="ts">
import type { UserSettingDefinition } from '../adapters/UserSettingsHttpAdapter'

import * as monaco from 'monaco-editor'
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { applyEndgeMonacoTheme } from '@/features/endge-ide/tools/source-editor/editor-surface-theme'

const props = defineProps<{
  modelValue: string
  catalog: readonly UserSettingDefinition[]
  readOnly: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t, locale } = useI18n()
const container = useTemplateRef<HTMLElement>('container')
const uri = monaco.Uri.parse(`inmemory://endge-user-settings/${crypto.randomUUID()}.json`)
const defaults = monaco.json.jsonDefaults
const schemaUri = `urn:endge:user-settings:${uri.path}`
let editor: monaco.editor.IStandaloneCodeEditor | undefined
let model: monaco.editor.ITextModel | undefined
let themeObserver: MutationObserver | undefined

function applySchema(): void {
  const language = locale.value.startsWith('ru') ? 'ru' : 'en'
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: Object.fromEntries(props.catalog.map(item => [item.key, {
      ...item.schema,
      description: item.description[language],
      ...(item.default != null ? { default: item.default } : {}),
    }])),
  }
  defaults.setDiagnosticsOptions({
    ...defaults.diagnosticsOptions,
    schemas: [
      ...(defaults.diagnosticsOptions.schemas ?? []).filter(item => item.uri !== schemaUri),
      { uri: schemaUri, fileMatch: [uri.toString()], schema },
    ],
  })
}

function applyTheme(): void {
  applyEndgeMonacoTheme(monaco, document.documentElement.classList.contains('dark'))
}

onMounted(() => {
  if (!container.value) {
    return
  }
  applySchema()
  applyTheme()
  model = monaco.editor.createModel(props.modelValue, 'json', uri)
  editor = monaco.editor.create(container.value, {
    model,
    readOnly: props.readOnly,
    ariaLabel: t('userSettings.jsonEditor'),
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'on',
    padding: { top: 16, bottom: 12 },
  })
  editor.onDidChangeModelContent(() => emit('update:modelValue', model?.getValue() ?? ''))
  themeObserver = new MutationObserver(applyTheme)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

watch(() => props.modelValue, (value) => {
  if (model?.getValue() !== value) {
    model?.setValue(value)
  }
})
watch(() => props.readOnly, readOnly => editor?.updateOptions({ readOnly }))
watch([() => props.catalog, locale], () => {
  if (model) {
    applySchema()
    editor?.updateOptions({ ariaLabel: t('userSettings.jsonEditor') })
  }
})
onBeforeUnmount(() => {
  editor?.dispose()
  model?.dispose()
  themeObserver?.disconnect()
  defaults.setDiagnosticsOptions({
    ...defaults.diagnosticsOptions,
    schemas: (defaults.diagnosticsOptions.schemas ?? []).filter(item => item.uri !== schemaUri),
  })
})
</script>

<template>
  <div ref="container" class="min-h-56 flex-1 overflow-hidden" />
</template>
