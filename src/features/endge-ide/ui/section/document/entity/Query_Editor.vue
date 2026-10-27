<script setup lang="ts">
import type { QuerySourceDocument } from '@endge/core'
import type { RQueryEditor } from '@/features/endge-ide/domain/entities/RQueryEditor'

import { Endge, QueryType } from '@endge/core'
import {
  Code2,
  Loader2,
  Play,
  RotateCcw,
  Save,
  Settings2,
  TriangleAlert,
} from 'lucide-vue-next'
import { computed, nextTick, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import { createEditorDiagnosticsEntityRef } from '@/features/endge-ide/services/diagnostics/editor-diagnostics-entity-ref'
import { collectGraphQLSchemaProblems } from '@/features/endge-ide/services/graphql-schema/graphql-schema-problems'
import { canRunQueryWithoutInput } from '@/features/endge-ide/services/query-run/query-run-form'
import EntityProblemsPanel from '@/features/endge-ide/ui/components/diagnostics/EntityProblemsPanel.vue'
import DocumentGeneralSettingsPanel from '@/features/endge-ide/ui/components/DocumentGeneralSettingsPanel.vue'
import GraphQLSchemaMenu from '@/features/endge-ide/ui/components/graphql-schema/GraphQLSchemaMenu.vue'
import QueryRunPanel from '@/features/endge-ide/ui/components/query-run/QueryRunPanel.vue'
import QuerySourceEditor from '@/features/endge-ide/ui/components/QuerySourceEditor.vue'
import DocumentIdentityInput from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdentityInput.vue'
import DocumentIdField from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdField.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import SourceFormatButton from '@/features/endge-ide/ui/components/source-document-editor/SourceFormatButton.vue'
import { useSmartTabSelection } from '@/features/endge-ide/ui/smart-tabs'

interface SourceEditorHandle {
  formatDocument: () => Promise<void>
}

interface QueryRunPanelHandle {
  run: () => Promise<void>
}

const tabs = EndgeIDE.tabs
const editor = computed<RQueryEditor | null>(
  () => tabs.documentEditorModel.value as RQueryEditor | null,
)
const activeTab = useSmartTabSelection(
  'editor.active-tab',
  'source',
  ['general', 'source', 'diagnostics'] as const,
)
const diagnosticsEntityRef = computed(() =>
  createEditorDiagnosticsEntityRef('query', editor.value),
)
// Маркеры схемы GraphQL в панели «Диагностика»; вычисляются, только пока панель открыта.
const schemaProblems = computed(() => editor.value
  ? collectGraphQLSchemaProblems(EndgeIDE.graphqlSchema, Endge.source, 'query', editor.value.source)
  : [])
// Видимость панели запуска — локальное состояние редактора Query.
const runPanelOpen = ref(false)
const runPanelRef = ref<QueryRunPanelHandle | null>(null)
const sourceEditorRef = ref<SourceEditorHandle | null>(null)
const parsedSource = computed(() => Endge.source.parse<QuerySourceDocument>('query', editor.value?.source ?? ''))
const queryDocumentType = computed(() =>
  parsedSource.value.document?.kind === 'graphql'
    ? QueryType.GraphQL
    : QueryType.REST,
)
// «Запустить» одним кликом: Source разобран и ни один prop не требует ввода.
const quickRunAvailable = computed(() => canRunQueryWithoutInput(parsedSource.value.document?.props))

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}

function resetSource(): void {
  editor.value?.applySourceText(Endge.source.createDefault(
    'query',
    queryDocumentType.value === QueryType.GraphQL ? 'graphql' : 'rest',
  ))
}

function toggleRunPanel(): void {
  runPanelOpen.value = !runPanelOpen.value
}

// Открывает панель запуска и сразу выполняет Query с default props.
async function quickRun(): Promise<void> {
  runPanelOpen.value = true
  await nextTick()
  await runPanelRef.value?.run()
}
</script>

<template>
  <div v-if="!editor" class="p-4 text-sm text-muted-foreground">
    {{ $t('uiText.noEditorF03cf60f') }}
  </div>
  <SourceDocumentEditorShell
    v-else
    :document-id="editor.id"
    :identity="editor.identity"
    :display-name="editor.name"
    :document-type="queryDocumentType"
    :dependency-source="editor.source"
    :dependency-draft="editor"
  >
    <template #center>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                :class="
                  activeTab === 'general'
                    ? 'bg-editor-control shadow-sm'
                    : 'text-muted-foreground'
                "
                aria-label="Основное"
                @click="activeTab = 'general'"
              >
                <Settings2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('uiText.basic127492c2') }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                :class="
                  activeTab === 'source'
                    ? 'bg-editor-control shadow-sm'
                    : 'text-muted-foreground'
                "
                aria-label="Source"
                @click="activeTab = 'source'"
              >
                <Code2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('uiText.sourceda13add2') }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                :class="
                  activeTab === 'diagnostics'
                    ? 'bg-editor-control shadow-sm'
                    : 'text-muted-foreground'
                "
                aria-label="Диагностика"
                @click="activeTab = 'diagnostics'"
              >
                <TriangleAlert class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('uiText.diagnosis9ba1e22a') }}</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                :class="runPanelOpen ? 'bg-editor-control shadow-sm' : ''"
                :aria-label="$t('endgeIde.queryRun.trigger')"
                :aria-pressed="runPanelOpen"
                @click="toggleRunPanel"
              >
                <Play class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('endgeIde.queryRun.trigger') }}</TooltipContent>
          </Tooltip>
          <Tooltip v-if="quickRunAvailable">
            <TooltipTrigger as-child>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="h-7 px-2 text-xs"
                data-testid="query-quick-run"
                @click="quickRun"
              >
                {{ $t('endgeIde.queryRun.quickRun') }}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('endgeIde.queryRun.quickRunHint') }}</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                aria-label="Сохранить"
                :disabled="EndgeIDE.busy.value"
                @click="save"
              >
                <Loader2
                  v-if="EndgeIDE.busy.value"
                  class="size-4 animate-spin"
                />
                <Save v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('uiText.save4864057d') }}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <template #right>
      <GraphQLSchemaMenu
        v-if="activeTab === 'source' && queryDocumentType === QueryType.GraphQL"
        source-kind="query"
        :source="editor.source"
        class="mr-1"
      />
      <TooltipProvider>
        <div
          v-if="activeTab === 'source'"
          class="flex items-center rounded-md border bg-muted/40 p-0.5"
        >
          <SourceFormatButton @click="sourceEditorRef?.formatDocument()" />
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                aria-label="Сбросить source"
                @click="resetSource"
              >
                <RotateCcw class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t('uiText.resetSourceC19e2677') }}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <div class="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <DocumentGeneralSettingsPanel v-if="activeTab === 'general'">
        <div class="max-w-2xl space-y-5">
          <DocumentIdField :document-id="editor.id" />
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="query-name">{{ $t('uiText.displayNamec7874aaa') }}</Label>
              <Input id="query-name" v-model="editor.name" />
            </div>
            <div class="space-y-2">
              <Label for="query-identity">{{ $t('uiText.identity7e5a975b') }}</Label>
              <DocumentIdentityInput
                id="query-identity"
                v-model="editor.identity"
                spellcheck="false"
              />
            </div>
          </div>
          <div class="max-w-xs space-y-2">
            <Label for="query-source-version">{{ $t('uiText.sourceVersionb94adbb6') }}</Label>
            <Input
              id="query-source-version"
              :model-value="editor.sourceVersion"
              type="number"
              disabled
            />
          </div>
        </div>
      </DocumentGeneralSettingsPanel>
      <div
        v-else-if="activeTab === 'source'"
        class="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-0"
      >
        <QuerySourceEditor
          ref="sourceEditorRef"
          :model-value="editor.source"
          class="min-h-0 flex-1"
          @update:model-value="(value) => editor?.applySourceText(value)"
        />
      </div>
      <EntityProblemsPanel
        v-else-if="diagnosticsEntityRef"
        :entity-ref="diagnosticsEntityRef"
        :authoring-diagnostics="schemaProblems"
        class="min-h-0 flex-1"
      />
      <QueryRunPanel
        v-if="runPanelOpen"
        ref="runPanelRef"
        :key="editor.id ?? editor.identity"
        :editor="editor"
        @close="runPanelOpen = false"
      />
    </div>
  </SourceDocumentEditorShell>
</template>
