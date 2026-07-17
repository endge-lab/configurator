<script setup lang="ts">
import type { RProjectEditor } from '@/features/endge-ide/domain/entities/RProjectEditor'

import type { EndgeConfigurationContribution } from '@endge/core'
import { DomainSectionType, Endge } from '@endge/core'
import { Briefcase } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useDomainStore } from '@endge/vue'

import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DomainEntityDropTarget from '@/features/endge-ide/ui/components/DomainEntityDropTarget.vue'
import OpenEntityButton from '@/features/endge-ide/ui/components/OpenEntityButton.vue'
import { isBusy } from '@/features/endge-ide/model/core/endge-ide-busy.ts'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import SaveDocumentButton from '@/features/endge-ide/ui/components/SaveDocumentButton.vue'
import ConfigurationSettingsEditor from '@/features/endge-ide/ui/components/configuration/ConfigurationSettingsEditor.vue'

const props = defineProps<{
  tabContext?: { editor?: RProjectEditor }
}>()

const domainStore = useDomainStore()
const editor = computed<RProjectEditor | null>(() => props.tabContext?.editor ?? null)
const tab = ref<'project' | 'navigation' | 'configuration'>('project')
const configuration = computed<EndgeConfigurationContribution>({
  get: () => editor.value?.configuration ?? { mode: 'inherit', patch: {} },
  set: value => { if (editor.value) editor.value.configuration = value },
})
const upstreamConfiguration = computed(() => Endge.configuration.resolveUpstream('project'))

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

const navigationOptions = computed(() => {
  const list = domainStore.navigations ?? []
  return [
    { value: SELECT_NONE, label: '- не выбран -' },
    ...list.map((n: { id?: string | number; identity?: string; displayName?: string; name?: string }) => ({
      value: n?.id != null ? String(n.id) : '',
      label: (n?.displayName ?? n?.name ?? n?.identity ?? String(n?.id ?? '')).trim() || String(n?.id ?? ''),
    })).filter((o: { value: string }) => o.value.length > 0),
  ]
})

function navigationIdForSelect(): string {
  const v = editor.value?.navigationId
  return v != null ? String(v) : SELECT_NONE
}

function onNavigationSelect(value: string): void {
  if (!editor.value) return
  editor.value.navigationId = value === SELECT_NONE ? null : normalizeRelationId(value)
}

function onNavigationDrop(id: string | number): void {
  if (!editor.value) return
  editor.value.navigationId = normalizeRelationId(id)
}

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <div class="p-3 border-b flex items-center gap-3 shrink-0">
      <div class="size-9 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
        <Briefcase class="size-4 text-sky-500" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-lg font-semibold truncate">
          Проект - {{ editor?.displayName ?? '-' }}
        </div>
        <div class="text-xs text-muted-foreground truncate">
          id: {{ editor?.id ?? '-' }} · identity: {{ editor?.identity ?? '-' }}
        </div>
      </div>
      <SaveDocumentButton :loading="isBusy" @click="save" />
    </div>

    <div class="flex-1 min-h-0 p-4">
        <Card class="h-full min-h-0 gap-0 overflow-hidden py-0">
          <Tabs v-model="tab" class="h-full flex flex-col min-h-0">
            <div class="border-b px-3 py-2">
              <TabsList class="grid w-full grid-cols-3">
                <TabsTrigger value="project">Проект</TabsTrigger>
                <TabsTrigger value="navigation">Навигация</TabsTrigger>
                <TabsTrigger value="configuration">Конфигурация</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="project" class="flex-1 min-h-0 overflow-hidden p-0 m-0 data-[state=inactive]:hidden">
              <ScrollArea class="h-full">
                <div class="p-4 space-y-4">
                  <div class="space-y-2">
                    <Label>Идентификатор</Label>
                    <Input v-model="editor!.identity" placeholder="my-project" />
                  </div>
                  <div class="space-y-2">
                    <Label>Название</Label>
                    <Input v-model="editor!.displayName" placeholder="Мой проект" />
                  </div>
                  <div class="space-y-2">
                    <Label>Slug (URL)</Label>
                    <Input :model-value="editor?.slug ?? ''" placeholder="my-project" @update:model-value="(v) => editor && (editor.slug = v || null)" />
                  </div>
                  <div class="space-y-2">
                    <Label>Описание</Label>
                    <textarea
                      :value="editor?.description ?? ''"
                      class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Краткое описание проекта"
                      @input="(e) => editor && (editor.description = (e.target as HTMLTextAreaElement).value || null)"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label>Порядок сортировки</Label>
                    <Input
                      type="number"
                      :model-value="editor?.order ?? ''"
                      placeholder="0"
                      @update:model-value="(v) => editor && (editor.order = v === '' || v == null ? null : Number(v))"
                    />
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="navigation" class="flex-1 min-h-0 overflow-hidden p-0 m-0 data-[state=inactive]:hidden">
              <ScrollArea class="h-full">
                <div class="p-4 space-y-4">
                  <div class="space-y-2">
                    <Label>Навигация проекта</Label>
                    <DomainEntityDropTarget
                      :accept-section-types="[DomainSectionType.Navigation]"
                      @update:model-value="onNavigationDrop"
                    >
                      <div class="flex items-center gap-1">
                        <SearchableSelect
                          :model-value="navigationIdForSelect()"
                          :options="navigationOptions"
                          placeholder="Выберите навигацию"
                          trigger-class="flex-1 min-w-0 h-9"
                          @update:model-value="onNavigationSelect"
                        />
                        <OpenEntityButton
                          :entity-id="editor?.navigationId ?? null"
                          :section-type="DomainSectionType.Navigation"
                        />
                      </div>
                    </DomainEntityDropTarget>
                    <p class="text-xs text-muted-foreground">Главное меню / навигация приложения проекта.</p>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="configuration" class="flex-1 min-h-0 overflow-hidden p-0 m-0 data-[state=inactive]:hidden">
              <ScrollArea class="h-full">
                <div class="p-4">
                  <ConfigurationSettingsEditor
                    v-model="configuration"
                    variant="contribution"
                    :upstream="upstreamConfiguration"
                  />
                </div>
              </ScrollArea>
            </TabsContent>

          </Tabs>
        </Card>
    </div>
  </div>
</template>
