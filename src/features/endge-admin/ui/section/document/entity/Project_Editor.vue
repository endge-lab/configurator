<script setup lang="ts">
import type { RProjectEditor } from '@/features/endge-admin/domain/entities/RProjectEditor'

import { DomainSectionType } from '@endge/core'
import { Briefcase, Loader2, Save } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useDomainStore } from '@endge/vue'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DomainEntityDropTarget from '@/features/endge-admin/ui/components/DomainEntityDropTarget.vue'
import OpenEntityButton from '@/features/endge-admin/ui/components/OpenEntityButton.vue'
import { isBusy } from '@/features/endge-admin/model/core/endge-admin-busy.ts'
import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'
import BehaviorBindingEditor from '@/features/endge-admin/ui/components/BehaviorBindingEditor.vue'
import PresentationBindingEditor from '@/features/endge-admin/ui/components/PresentationBindingEditor.vue'

const props = defineProps<{
  tabContext?: { editor?: RProjectEditor }
}>()

const domainStore = useDomainStore()
const editor = computed<RProjectEditor | null>(() => props.tabContext?.editor ?? null)
const tab = ref<'project' | 'navigation' | 'events' | 'presentation'>('project')

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

const settingsOptions = computed(() => {
  const list = domainStore.settings ?? []
  return [
    { value: SELECT_NONE, label: '- не выбран -' },
    ...list.map((s: { id?: string | number; identity?: string; displayName?: string }) => ({
      value: s?.id != null ? String(s.id) : '',
      label: (s?.displayName ?? s?.identity ?? String(s?.id ?? '')).trim() || String(s?.id ?? ''),
    })).filter((o: { value: string }) => o.value.length > 0),
  ]
})

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

function settingsIdForSelect(): string {
  const v = editor.value?.settingsId
  return v != null ? String(v) : SELECT_NONE
}

function navigationIdForSelect(): string {
  const v = editor.value?.navigationId
  return v != null ? String(v) : SELECT_NONE
}

function onSettingsSelect(value: string): void {
  if (!editor.value) return
  editor.value.settingsId = value === SELECT_NONE ? null : normalizeRelationId(value)
}

function onNavigationSelect(value: string): void {
  if (!editor.value) return
  editor.value.navigationId = value === SELECT_NONE ? null : normalizeRelationId(value)
}

function onSettingsDrop(id: string | number): void {
  if (!editor.value) return
  editor.value.settingsId = normalizeRelationId(id)
}

function onNavigationDrop(id: string | number): void {
  if (!editor.value) return
  editor.value.navigationId = normalizeRelationId(id)
}

async function save(): Promise<void> {
  await EndgeAdmin.tabs.save()
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
      <Button variant="outline" size="sm" :disabled="isBusy" @click="save">
        <Loader2 v-if="isBusy" class="size-4 animate-spin mr-1" />
        <Save v-else class="size-4 mr-1" />
        Сохранить
      </Button>
    </div>

    <ScrollArea class="flex-1">
      <div class="p-4">
        <Card class="min-h-[calc(100vh-15rem)]">
          <Tabs v-model="tab" class="h-full flex flex-col min-h-0">
            <div class="border-b px-3 py-2">
              <TabsList class="grid w-full grid-cols-4">
                <TabsTrigger value="project">Проект</TabsTrigger>
                <TabsTrigger value="navigation">Навигация</TabsTrigger>
                <TabsTrigger value="events">События</TabsTrigger>
                <TabsTrigger value="presentation">Presentation</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="project" class="flex-1 min-h-0 p-0 m-0 data-[state=inactive]:hidden">
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
                  <div class="space-y-2">
                    <Label>Профиль настроек</Label>
                    <DomainEntityDropTarget
                      :accept-section-types="[DomainSectionType.Settings]"
                      @update:model-value="onSettingsDrop"
                    >
                      <div class="flex items-center gap-1">
                        <SearchableSelect
                          :model-value="settingsIdForSelect()"
                          :options="settingsOptions"
                          placeholder="Выберите профиль настроек"
                          trigger-class="flex-1 min-w-0 h-9"
                          @update:model-value="onSettingsSelect"
                        />
                        <OpenEntityButton
                          :entity-id="editor?.settingsId ?? null"
                          :section-type="DomainSectionType.Settings"
                        />
                      </div>
                    </DomainEntityDropTarget>
                    <p class="text-xs text-muted-foreground">Настройки проекта (vars, auth, vocabs и т.д.).</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <Checkbox :checked="editor?.extendSettings ?? true" @update:checked="(v) => editor && (editor.extendSettings = !!v)" />
                    <Label class="text-sm">Наследовать настройки</Label>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="navigation" class="flex-1 min-h-0 p-0 m-0 data-[state=inactive]:hidden">
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

            <TabsContent value="events" class="flex-1 min-h-0 p-0 m-0 data-[state=inactive]:hidden">
              <ScrollArea class="h-full">
                <div class="p-4">
                  <BehaviorBindingEditor
                    :editor-model="editor"
                    owner-type="project"
                    :owner-id="editor?.id ?? null"
                    target-type="project"
                    :target-id="editor?.id ?? null"
                    :project-id="editor?.id ?? null"
                    document-type="project"
                    :allowed-environment-ids="editor?.allowedEnvironmentIds ?? []"
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="presentation" class="flex-1 min-h-0 p-0 m-0 data-[state=inactive]:hidden">
              <ScrollArea class="h-full">
                <div class="p-4">
                  <PresentationBindingEditor
                    :editor-model="editor"
                    owner-type="project"
                    :owner-id="editor?.id ?? null"
                    target-type="project"
                    :target-id="editor?.id ?? null"
                    :project-id="editor?.id ?? null"
                    :allowed-environment-ids="editor?.allowedEnvironmentIds ?? []"
                  />
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </ScrollArea>
  </div>
</template>
