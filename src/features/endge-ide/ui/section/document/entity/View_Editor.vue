<script setup lang="ts">
import { DomainSectionType } from '@endge/core'
import { Eye, Loader2, Save } from 'lucide-vue-next'
import { computed } from 'vue'
import { useDomainStore } from '@endge/vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import DomainEntityDropTarget from '@/features/endge-ide/ui/components/DomainEntityDropTarget.vue'
import BehaviorBindingEditor from '@/features/endge-ide/ui/components/BehaviorBindingEditor.vue'
import PresentationBindingEditor from '@/features/endge-ide/ui/components/PresentationBindingEditor.vue'
import OpenEntityButton from '@/features/endge-ide/ui/components/OpenEntityButton.vue'
import { isBusy } from '@/features/endge-ide/model/core/endge-ide-busy.ts'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const domainStore = useDomainStore()
const tabs = EndgeIDE.tabs
const editor = computed(() => tabs.documentEditorModel.value as {
  id: number
  identity: string
  displayName: string
  description: string
  componentId: number | null
  filterId: number | null
  queryId: number | null
} | null ?? null)
const documentModel = computed(() => tabs.documentModel.value as { isSystem?: boolean } | null ?? null)
const isSystem = computed(() => documentModel.value?.isSystem === true)
const projectId = computed(() => normalizeRelationId((tabs.documentModel.value as { project?: unknown } | null)?.project))

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}

const SELECT_NONE = '__none__'

function normalizeRelationId(value: unknown): number | null {
  if (value == null)
    return null
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : null
  const text = String(value).trim()
  if (!text)
    return null
  const id = Number(text)
  return Number.isFinite(id) ? id : null
}

const componentOptions = computed(() => {
  const list = domainStore.components ?? []
  return [
    { value: SELECT_NONE, label: '- не выбран -' },
    ...list.map((c: any) => ({
      value: c?.id != null ? String(c.id) : '',
      label: `${c?.name ?? c?.displayName ?? c?.identity ?? c?.id ?? ''}`.trim() || String(c?.id ?? ''),
    })).filter((o: { value: string }) => o.value.length > 0),
  ]
})
const filterOptions = computed(() => {
  const list = domainStore.filters ?? []
  return [
    { value: SELECT_NONE, label: '- не выбран -' },
    ...list.map((f: any) => ({
      value: f?.id != null ? String(f.id) : '',
      label: `${f?.displayName ?? f?.name ?? f?.identity ?? f?.id ?? ''}`.trim() || String(f?.id ?? ''),
    })).filter((o: { value: string }) => o.value.length > 0),
  ]
})
const queryOptions = computed(() => {
  const list = domainStore.queries ?? []
  return [
    { value: SELECT_NONE, label: '- не выбран -' },
    ...list.map((q: any) => ({
      value: q?.id != null ? String(q.id) : '',
      label: `${q?.name ?? q?.displayName ?? q?.identity ?? q?.id ?? ''}`.trim() || String(q?.id ?? ''),
    })).filter((o: { value: string }) => o.value.length > 0),
  ]
})

</script>

<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <!-- Заголовок: иконка, название, бейдж, кнопки - в одну строку -->
    <div class="flex items-center gap-3 px-3 py-3 border-b shrink-0 min-h-[52px]">
      <div class="size-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
        <Eye class="size-4 text-indigo-500" />
      </div>
      <div class="min-w-0 flex-1 flex flex-col gap-0.5">
        <div class="text-lg font-semibold truncate">
          Вид - {{ editor?.displayName ?? '-' }}
        </div>
        <div class="text-xs text-muted-foreground truncate">
          id: {{ editor?.id ?? '-' }} · identity: {{ editor?.identity ?? '-' }}
        </div>
        <Badge v-if="isSystem" variant="outline" class="rounded-full border-orange-200 bg-amber-500/10 text-amber-700 font-normal dark:border-orange-300/50 dark:bg-amber-500/15 dark:text-amber-600 w-fit mt-0.5">
          Системный
        </Badge>
      </div>
      <TooltipProvider :delay-duration="120">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" aria-label="Сохранить" :disabled="isSystem || isBusy" @click="save">
              <Loader2 v-if="isBusy" class="h-4 w-4 animate-spin" />
              <Save v-else class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Сохранить</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>

    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <div class="flex flex-wrap items-start gap-4">
          <div class="flex-1 min-w-[180px] space-y-2">
            <Label>Компонент</Label>
            <DomainEntityDropTarget
              :accept-section-types="[DomainSectionType.Component]"
              @update:model-value="editor && (editor.componentId = normalizeRelationId($event))"
            >
              <div class="flex items-center gap-1">
                <SearchableSelect
                  :model-value="editor?.componentId != null ? String(editor.componentId) : SELECT_NONE"
                  :options="componentOptions"
                  :disabled="isSystem"
                  placeholder="Выберите компонент"
                  trigger-class="flex-1 min-w-0 h-9"
                  @update:model-value="editor && (editor.componentId = $event === SELECT_NONE ? null : normalizeRelationId($event))"
                />
                <OpenEntityButton
                  :entity-id="editor?.componentId ?? null"
                  :section-type="DomainSectionType.Component"
                />
              </div>
            </DomainEntityDropTarget>
          </div>
          <div class="flex-1 min-w-[180px] space-y-2">
            <Label>Фильтр</Label>
            <DomainEntityDropTarget
              :accept-section-types="[DomainSectionType.Filters]"
              @update:model-value="editor && (editor.filterId = normalizeRelationId($event))"
            >
              <div class="flex items-center gap-1">
                <SearchableSelect
                  :model-value="editor?.filterId != null ? String(editor.filterId) : SELECT_NONE"
                  :options="filterOptions"
                  :disabled="isSystem"
                  placeholder="Выберите фильтр"
                  trigger-class="flex-1 min-w-0 h-9"
                  @update:model-value="editor && (editor.filterId = $event === SELECT_NONE ? null : normalizeRelationId($event))"
                />
                <OpenEntityButton
                  :entity-id="editor?.filterId ?? null"
                  :section-type="DomainSectionType.Filters"
                />
              </div>
            </DomainEntityDropTarget>
          </div>
          <div class="flex-1 min-w-[180px] space-y-2">
            <Label>Запрос</Label>
            <DomainEntityDropTarget
              :accept-section-types="[DomainSectionType.Query]"
              @update:model-value="editor && (editor.queryId = normalizeRelationId($event))"
            >
              <div class="flex items-center gap-1">
                <SearchableSelect
                  :model-value="editor?.queryId != null ? String(editor.queryId) : SELECT_NONE"
                  :options="queryOptions"
                  :disabled="isSystem"
                  placeholder="Выберите запрос"
                  trigger-class="flex-1 min-w-0 h-9"
                  @update:model-value="editor && (editor.queryId = $event === SELECT_NONE ? null : normalizeRelationId($event))"
                />
                <OpenEntityButton
                  :entity-id="editor?.queryId ?? null"
                  :section-type="DomainSectionType.Query"
                />
              </div>
            </DomainEntityDropTarget>
          </div>
        </div>
        <div class="space-y-2">
          <Label>Описание</Label>
          <textarea
            :value="editor?.description ?? ''"
            :disabled="isSystem"
            class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Краткое описание вида"
            @input="editor && (editor.description = (($event.target as HTMLTextAreaElement).value ?? ''))"
          />
        </div>
        <div class="rounded-md border p-3">
          <BehaviorBindingEditor
            :editor-model="editor"
            owner-type="view"
            :owner-id="editor?.id ?? null"
            target-type="view"
            :target-id="editor?.id ?? null"
            :project-id="projectId"
            document-type="view"
          />
        </div>
        <div class="rounded-md border p-3">
          <PresentationBindingEditor
            :editor-model="editor"
            owner-type="view"
            :owner-id="editor?.id ?? null"
            target-type="view"
            :target-id="editor?.id ?? null"
            :project-id="projectId"
          />
        </div>
      </div>
    </ScrollArea>
  </div>
</template>

<style>
/* Ширина модалки «Код для вставки» (диалог в портале, переопределяем sm:max-w-lg). */
.copy-code-dialog {
  max-width: min(72rem, calc(100vw - 2rem)) !important;
  width: 100%;
}
</style>
