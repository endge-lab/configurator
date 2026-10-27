<script setup lang="ts">
import type { RQueryEditor } from '@/features/endge-ide/domain/entities/RQueryEditor'
import type { QueryRunErrorKind, QueryRunResult } from '@/features/endge-ide/services/query-run/query-runner'

import { Loader2, Play } from 'lucide-vue-next'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createEndgeQueryRunDependencies, resolveWorkspaceEnvironment } from '@/features/endge-ide/services/query-run/query-run-endge'
import {
  parseQueryRunValues,
  previewGraphQLVariables,
  QUERY_RUN_DEFAULT_OPTION,
  readQueryRunForm,
} from '@/features/endge-ide/services/query-run/query-run-form'
import { runQueryForPanel } from '@/features/endge-ide/services/query-run/query-runner'
import { compilePreviewSource } from '@/features/endge-ide/services/source-preview/compile-preview-source'
import SourceJsonTree from '@/features/endge-ide/ui/components/SourceJsonTree.vue'
import SourceOutputPanel from '@/features/endge-ide/ui/components/SourceOutputPanel.vue'

type ResultTab = 'response' | 'request' | 'errors' | 'outputs'

const props = defineProps<{
  editor: RQueryEditor
}>()

const emit = defineEmits<{
  (event: 'close'): void
}>()

const { t } = useI18n()

function errorKindLabel(kind: QueryRunErrorKind): string {
  switch (kind) {
    case 'compile':
      return t('endgeIde.queryRun.errorKind.compile')
    case 'graphql':
      return t('endgeIde.queryRun.errorKind.graphql')
    case 'response-format':
      return t('endgeIde.queryRun.errorKind.responseFormat')
    case 'transport':
      return t('endgeIde.queryRun.errorKind.transport')
    default:
      return t('endgeIde.queryRun.errorKind.runtime')
  }
}

// Значения формы и результат живут только пока панель открыта.
const values = ref<Record<string, string>>({})
const running = ref(false)
const result = shallowRef<QueryRunResult | null>(null)
const activeTab = ref<ResultTab>('response')

const form = computed(() => readQueryRunForm(compilePreviewSource('query', props.editor.source)))
const parsed = computed(() => parseQueryRunValues(form.value.fields, values.value))
const variablesPreview = computed(() => form.value.protocol === 'GraphQL'
  ? previewGraphQLVariables(form.value.payload, parsed.value.props, resolveWorkspaceEnvironment)
  : null)
const canRun = computed(() => !running.value && !form.value.compileError && !Object.keys(parsed.value.errors).length)
const tabs = computed(() => {
  const items: { id: ResultTab, label: string }[] = [
    { id: 'response', label: t('endgeIde.queryRun.tabs.response') },
    { id: 'request', label: t('endgeIde.queryRun.tabs.request') },
  ]
  if (result.value?.request?.protocol === 'GraphQL' || form.value.protocol === 'GraphQL') {
    items.push({ id: 'errors', label: t('endgeIde.queryRun.tabs.errors', { count: result.value?.graphQLErrors.length ?? 0 }) })
  }
  items.push({ id: 'outputs', label: t('endgeIde.queryRun.tabs.outputs') })
  return items
})
const graphQLBody = computed(() => {
  const body = result.value?.request?.protocol === 'GraphQL' ? result.value.request.body : null
  return body && typeof body === 'object' ? body as { query?: unknown, variables?: unknown } : null
})

function fieldValue(key: string): string {
  return values.value[key] ?? ''
}

function setFieldValue(key: string, value: unknown): void {
  values.value = { ...values.value, [key]: value == null ? '' : String(value) }
}

function fieldError(key: string): string | null {
  switch (parsed.value.errors[key]) {
    case undefined:
      return null
    case 'number':
      return t('endgeIde.queryRun.props.invalid.number')
    case 'boolean':
      return t('endgeIde.queryRun.props.invalid.boolean')
    default:
      return t('endgeIde.queryRun.props.invalid.json')
  }
}

function formatPath(path: unknown): string {
  return Array.isArray(path) ? path.join('.') : ''
}

function formatLocations(locations: unknown): string {
  return Array.isArray(locations)
    ? locations.map(location => `${location?.line}:${location?.column}`).join(', ')
    : ''
}

function entries(record: Record<string, unknown> | undefined): [string, string][] {
  return Object.entries(record ?? {}).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])
}

/**
 * Запускает Query с текущими значениями формы; ошибки остаются в результате панели.
 */
async function run(): Promise<void> {
  if (!canRun.value) {
    return
  }
  running.value = true
  try {
    const next = await runQueryForPanel(createEndgeQueryRunDependencies(props.editor), parsed.value.props)
    result.value = next
    activeTab.value = next.error?.kind === 'graphql' || (next.graphQLErrors.length && !next.error)
      ? 'errors'
      : next.response || !next.request ? 'response' : 'request'
  }
  finally {
    running.value = false
  }
}

defineExpose({ run })
</script>

<template>
  <SourceOutputPanel
    :collapsed="false"
    :title="t('endgeIde.queryRun.title')"
    :collapse-label="t('endgeIde.queryRun.close')"
    :expand-label="t('endgeIde.queryRun.trigger')"
    mode="full-height"
    class="query-run-panel"
    @update:collapsed="(collapsed) => collapsed && emit('close')"
  >
    <template #meta>
      <Badge variant="outline" class="h-5 px-1.5 text-[10px]">
        {{ form.protocol }}
      </Badge>
    </template>
    <template #actions>
      <Button
        type="button"
        size="sm"
        class="h-7 gap-1.5"
        :disabled="!canRun"
        @click="run"
      >
        <Loader2 v-if="running" class="size-3.5 animate-spin" />
        <Play v-else class="size-3.5" />
        {{ t('endgeIde.queryRun.run') }}
      </Button>
    </template>

    <div class="query-run-panel__body" @keydown.enter.meta.prevent="run" @keydown.enter.ctrl.prevent="run">
      <p v-if="form.compileError" class="query-run-panel__error">
        {{ t('endgeIde.queryRun.compileError', { message: form.compileError }) }}
      </p>

      <section class="query-run-panel__section">
        <h3 class="query-run-panel__heading">
          {{ t('endgeIde.queryRun.props.title') }}
        </h3>
        <p v-if="!form.fields.length" class="query-run-panel__muted">
          {{ t('endgeIde.queryRun.props.empty') }}
        </p>
        <template v-else>
          <p class="query-run-panel__muted">
            {{ t('endgeIde.queryRun.props.hint') }}
          </p>
          <div v-for="field in form.fields" :key="field.key" class="query-run-panel__field">
            <label :for="`query-run-${field.key}`" class="query-run-panel__label">
              <span class="font-mono">{{ field.key }}</span>
              <span class="query-run-panel__type">{{ field.typeLabel }}</span>
              <span v-if="field.optional" class="query-run-panel__muted">{{ t('endgeIde.queryRun.props.optional') }}</span>
            </label>
            <Select
              v-if="field.control === 'boolean'"
              :model-value="fieldValue(field.key) || QUERY_RUN_DEFAULT_OPTION"
              @update:model-value="(value) => setFieldValue(field.key, value)"
            >
              <SelectTrigger :id="`query-run-${field.key}`" class="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="QUERY_RUN_DEFAULT_OPTION">
                  {{ t('endgeIde.queryRun.props.useDefault') }}
                </SelectItem>
                <SelectItem value="true">
                  {{ t('endgeIde.queryRun.props.booleanTrue') }}
                </SelectItem>
                <SelectItem value="false">
                  {{ t('endgeIde.queryRun.props.booleanFalse') }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              v-else-if="field.control === 'json'"
              :id="`query-run-${field.key}`"
              :model-value="fieldValue(field.key)"
              :placeholder="field.defaultText ?? 'JSON'"
              class="min-h-14 font-mono text-xs"
              spellcheck="false"
              @update:model-value="(value) => setFieldValue(field.key, value)"
            />
            <Input
              v-else
              :id="`query-run-${field.key}`"
              :model-value="fieldValue(field.key)"
              :type="field.control === 'number' ? 'number' : 'text'"
              :placeholder="field.defaultText ?? ''"
              class="h-8 font-mono text-xs"
              spellcheck="false"
              @update:model-value="(value) => setFieldValue(field.key, value)"
            />
            <p v-if="fieldError(field.key)" class="query-run-panel__field-error">
              {{ fieldError(field.key) }}
            </p>
            <p v-else-if="field.defaultText !== null" class="query-run-panel__muted">
              {{ t('endgeIde.queryRun.props.default', { value: field.defaultText }) }}
            </p>
            <p v-else-if="field.defaultFromFilter" class="query-run-panel__muted">
              {{ t('endgeIde.queryRun.props.defaultFromFilter') }}
            </p>
          </div>
        </template>
      </section>

      <section v-if="variablesPreview" class="query-run-panel__section">
        <h3 class="query-run-panel__heading">
          {{ t('endgeIde.queryRun.variables.title') }}
        </h3>
        <p v-if="variablesPreview.error" class="query-run-panel__field-error">
          {{ t('endgeIde.queryRun.variables.error', { message: variablesPreview.error }) }}
        </p>
        <pre v-else class="query-run-panel__code">{{ JSON.stringify(variablesPreview.value, null, 2) }}</pre>
      </section>

      <section v-if="result" class="query-run-panel__section query-run-panel__result">
        <div class="query-run-panel__summary">
          <Badge :variant="result.status === 'success' ? 'secondary' : 'destructive'" class="h-5 px-1.5 text-[10px]">
            {{ result.status === 'success' ? t('endgeIde.queryRun.status.success') : t('endgeIde.queryRun.status.error') }}
          </Badge>
          <span v-if="result.response?.status">{{ t('endgeIde.queryRun.httpStatus', { status: result.response.status }) }}</span>
          <span>{{ t('endgeIde.queryRun.duration', { ms: result.durationMs }) }}</span>
        </div>
        <p v-if="!result.requestSent && !result.error" class="query-run-panel__muted">
          {{ t('endgeIde.queryRun.notSent') }}
        </p>
        <div v-if="result.error" class="query-run-panel__error" role="alert">
          <strong>{{ errorKindLabel(result.error.kind) }}</strong>
          <pre>{{ result.error.message }}</pre>
        </div>

        <div class="query-run-panel__tabs" role="tablist">
          <Button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            variant="ghost"
            size="sm"
            role="tab"
            class="h-7 px-2 text-xs"
            :aria-selected="activeTab === tab.id"
            :class="activeTab === tab.id ? 'bg-editor-control shadow-sm' : 'text-muted-foreground'"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </Button>
        </div>

        <div v-if="activeTab === 'response'" class="query-run-panel__tab">
          <p v-if="!result.response" class="query-run-panel__muted">
            {{ t('endgeIde.queryRun.response.empty') }}
          </p>
          <pre v-else-if="typeof result.response.data === 'string'" class="query-run-panel__code">{{ result.response.data }}</pre>
          <SourceJsonTree v-else :data="result.response.data" root-path="response" :deep="2" />
        </div>

        <div v-else-if="activeTab === 'request'" class="query-run-panel__tab">
          <p v-if="!result.request" class="query-run-panel__muted">
            {{ t('endgeIde.queryRun.notSent') }}
          </p>
          <template v-else>
            <p class="query-run-panel__request-line">
              <span class="font-semibold">{{ result.request.method }}</span>
              <span class="break-all">{{ result.request.url }}</span>
            </p>
            <p v-if="result.request.redacted.length" class="query-run-panel__muted">
              {{ t('endgeIde.queryRun.request.redacted', { names: result.request.redacted.join(', ') }) }}
            </p>
            <h4 class="query-run-panel__subheading">
              {{ t('endgeIde.queryRun.request.headers') }}
            </h4>
            <dl class="query-run-panel__pairs">
              <template v-for="[name, value] in entries(result.request.headers)" :key="name">
                <dt>{{ name }}</dt>
                <dd>{{ value }}</dd>
              </template>
            </dl>
            <template v-if="Object.keys(result.request.params).length">
              <h4 class="query-run-panel__subheading">
                {{ t('endgeIde.queryRun.request.params') }}
              </h4>
              <dl class="query-run-panel__pairs">
                <template v-for="[name, value] in entries(result.request.params)" :key="name">
                  <dt>{{ name }}</dt>
                  <dd>{{ value }}</dd>
                </template>
              </dl>
            </template>
            <template v-if="graphQLBody">
              <h4 class="query-run-panel__subheading">
                {{ t('endgeIde.queryRun.request.variables') }}
              </h4>
              <pre class="query-run-panel__code">{{ JSON.stringify(graphQLBody.variables ?? {}, null, 2) }}</pre>
              <h4 class="query-run-panel__subheading">
                {{ t('endgeIde.queryRun.request.document') }}
              </h4>
              <pre class="query-run-panel__code">{{ graphQLBody.query }}</pre>
            </template>
            <template v-else>
              <h4 class="query-run-panel__subheading">
                {{ t('endgeIde.queryRun.request.body') }}
              </h4>
              <p v-if="result.request.body === undefined" class="query-run-panel__muted">
                {{ t('endgeIde.queryRun.request.empty') }}
              </p>
              <pre v-else class="query-run-panel__code">{{ JSON.stringify(result.request.body, null, 2) }}</pre>
            </template>
          </template>
        </div>

        <div v-else-if="activeTab === 'errors'" class="query-run-panel__tab">
          <p v-if="!result.graphQLErrors.length" class="query-run-panel__muted">
            {{ t('endgeIde.queryRun.graphqlErrors.empty') }}
          </p>
          <article
            v-for="(error, index) in result.graphQLErrors"
            :key="index"
            class="query-run-panel__graphql-error"
          >
            <p class="font-medium text-red-300">
              {{ error.message }}
            </p>
            <p v-if="formatPath(error.path)" class="query-run-panel__muted">
              {{ t('endgeIde.queryRun.graphqlErrors.path') }}: <span class="font-mono">{{ formatPath(error.path) }}</span>
            </p>
            <p v-if="formatLocations(error.locations)" class="query-run-panel__muted">
              {{ t('endgeIde.queryRun.graphqlErrors.locations') }}: <span class="font-mono">{{ formatLocations(error.locations) }}</span>
            </p>
            <template v-if="error.extensions">
              <p class="query-run-panel__muted">
                {{ t('endgeIde.queryRun.graphqlErrors.extensions') }}
              </p>
              <SourceJsonTree :data="error.extensions" root-path="extensions" :deep="2" />
            </template>
          </article>
        </div>

        <div v-else class="query-run-panel__tab">
          <p v-if="!result.outputs" class="query-run-panel__muted">
            {{ t('endgeIde.queryRun.outputs.empty') }}
          </p>
          <SourceJsonTree v-else :data="result.outputs" root-path="outputs" :deep="2" />
        </div>
      </section>
    </div>
  </SourceOutputPanel>
</template>

<style scoped>
.query-run-panel__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 10px 12px 16px;
  font-size: 12px;
}

.query-run-panel__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.query-run-panel__result {
  border-top: 1px solid rgb(71 85 105 / 0.75);
  padding-top: 10px;
}

.query-run-panel__heading {
  color: #93c5fd;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.query-run-panel__subheading {
  margin-top: 6px;
  color: #cbd5e1;
  font-size: 11px;
  font-weight: 600;
}

.query-run-panel__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.query-run-panel__label {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: #e5e7eb;
}

.query-run-panel__type {
  color: #7dd3fc;
  font-family: ui-monospace, monospace;
  font-size: 11px;
}

.query-run-panel__muted {
  color: #94a3b8;
  font-size: 11px;
}

.query-run-panel__field-error {
  color: #fca5a5;
  font-size: 11px;
}

.query-run-panel__error {
  border: 1px solid rgb(248 113 113 / 0.5);
  border-radius: 6px;
  background: rgb(127 29 29 / 0.25);
  padding: 6px 8px;
  color: #fecaca;
}

.query-run-panel__error pre,
.query-run-panel__code {
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, monospace;
  font-size: 11px;
}

.query-run-panel__code {
  border-radius: 6px;
  background: rgb(15 23 42 / 0.7);
  padding: 6px 8px;
  color: #e2e8f0;
}

.query-run-panel__summary {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #cbd5e1;
}

.query-run-panel__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  border-radius: 6px;
  border: 1px solid rgb(71 85 105 / 0.75);
  padding: 2px;
}

.query-run-panel__tab {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
}

.query-run-panel__request-line {
  display: flex;
  gap: 6px;
  font-family: ui-monospace, monospace;
  color: #e2e8f0;
}

.query-run-panel__pairs {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px 8px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
}

.query-run-panel__pairs dt {
  color: #93c5fd;
}

.query-run-panel__pairs dd {
  color: #e2e8f0;
  word-break: break-all;
}

.query-run-panel__graphql-error {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-bottom: 1px solid rgb(51 65 85 / 0.72);
  padding-bottom: 6px;
}
</style>
