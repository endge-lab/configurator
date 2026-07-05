<script setup lang="ts">
import { computed } from 'vue'
import { useDomainStore } from '@endge/vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const props = defineProps<{
  tabContext?: {
    document?: {
      editor?: {
        identity: string
        displayName: string
        description?: string
        routeName?: string
        routePath?: string
        templateId?: string | number | null
        controllerId?: string | number | null
        enabled?: boolean
      }
      previewModel?: {
        id?: string
        name?: string
        description?: string | null
        routeName?: string | null
        routePath?: string | null
        templateId?: string | number | null
        controllerId?: string | number | null
        enabled?: boolean
        isSystem?: boolean
        areas?: unknown[]
      }
      component?: unknown
    }
  }
}>()

const editor = computed(() => props.tabContext?.document?.editor ?? null)
type PageInspectorModel = {
  id?: string
  name?: string
  description?: string | null
  routeName?: string | null
  routePath?: string | null
  templateId?: string | number | null
  controllerId?: string | number | null
  enabled?: boolean
  isSystem?: boolean
  areas?: unknown[]
}
const model = computed<PageInspectorModel | null>(
  () => (props.tabContext?.document?.previewModel ?? props.tabContext?.document?.component ?? editor.value ?? null) as PageInspectorModel | null,
)
const isSystem = computed(() => model.value?.isSystem === true)
const domainStore = useDomainStore()

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

const templateOptions = computed(() => {
  const list = domainStore.pageTemplates ?? []
  return list
    .map((t: any) => ({
      value: t?.id != null ? String(t.id) : '',
      label: `${t?.name ?? t?.displayName ?? t?.identity ?? t?.id ?? ''}`.trim() || String(t?.id ?? ''),
    }))
    .filter((o: { value: string }) => o.value.length > 0)
})
const viewOptions = computed(() => {
  const list = domainStore.views ?? []
  return list
    .map((v: any) => ({
      value: v?.id != null ? String(v.id) : '',
      label: `${v?.displayName ?? v?.name ?? v?.identity ?? v?.id ?? ''}`.trim() || String(v?.id ?? ''),
    }))
    .filter((o: { value: string }) => o.value.length > 0)
})
const areasCount = computed(() => {
  const fromEditor = model.value?.areas
  return Array.isArray(fromEditor) ? fromEditor.length : 0
})

function setTemplate(value: string | null): void {
  if (!editor.value)
    return
  editor.value.templateId = normalizeRelationId(value)
}

function setController(value: string | null): void {
  if (!editor.value)
    return
  editor.value.controllerId = normalizeRelationId(value)
}

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <div v-if="!model" class="flex items-center justify-center h-full text-sm text-muted-foreground">
    Выберите страницу
  </div>
  <div v-else class="flex flex-col h-full">
    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <Badge
          v-if="isSystem"
          variant="outline"
          class="rounded-full border-orange-200 bg-amber-500/10 text-amber-700 font-normal dark:border-orange-300/50 dark:bg-amber-500/15 dark:text-amber-600"
        >
          Системная
        </Badge>

        <div class="space-y-2">
          <label class="text-sm font-medium">Идентификатор</label>
          <Input
            :model-value="editor?.identity ?? model?.id ?? ''"
            :disabled="isSystem"
            placeholder="например: page.schedule"
            @update:model-value="(v) => editor && (editor.identity = String(v ?? ''))"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Название</label>
          <Input
            :model-value="editor?.displayName ?? model?.name ?? ''"
            :disabled="isSystem"
            placeholder="Отображаемое имя"
            @update:model-value="(v) => editor && (editor.displayName = String(v ?? ''))"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Описание</label>
          <Textarea
            :model-value="editor?.description ?? model?.description ?? ''"
            :disabled="isSystem"
            :rows="2"
            placeholder="Краткое описание страницы"
            @update:model-value="(v) => editor && (editor.description = String(v ?? ''))"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">routeName</label>
          <Input
            :model-value="editor?.routeName ?? model?.routeName ?? ''"
            :disabled="isSystem"
            placeholder="schedule"
            @update:model-value="(v) => editor && (editor.routeName = String(v ?? ''))"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">routePath</label>
          <Input
            :model-value="editor?.routePath ?? model?.routePath ?? ''"
            :disabled="isSystem"
            placeholder="/schedule"
            @update:model-value="(v) => editor && (editor.routePath = String(v ?? ''))"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Шаблон страницы</label>
          <SearchableSelect
            :model-value="editor?.templateId != null ? String(editor.templateId) : (model?.templateId != null ? String(model.templateId) : null)"
            :options="templateOptions"
            :disabled="isSystem"
            placeholder="Выберите шаблон страницы"
            trigger-class="w-full h-9"
            @update:model-value="(v) => setTemplate(v != null ? String(v) : null)"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Контроллер</label>
          <SearchableSelect
            :model-value="editor?.controllerId != null ? String(editor.controllerId) : (model?.controllerId != null ? String(model.controllerId) : null)"
            :options="viewOptions"
            :disabled="isSystem"
            placeholder="Выберите view-контроллер"
            trigger-class="w-full h-9"
            @update:model-value="(v) => setController(v != null ? String(v) : null)"
          />
        </div>

        <div class="flex items-center justify-between gap-3">
          <label class="text-sm font-medium">Включена</label>
          <Switch
            :checked="editor?.enabled ?? model?.enabled ?? true"
            :disabled="isSystem || !editor"
            @update:checked="(v) => editor && (editor.enabled = !!v)"
          />
        </div>

        <p class="text-xs text-muted-foreground">
          Областей: {{ areasCount }}
        </p>
      </div>
    </ScrollArea>

    <div class="border-t p-4">
      <Button class="w-full" :disabled="isSystem || EndgeIDE.busy.value" @click="save">
        <span v-if="EndgeIDE.busy.value" class="inline-flex items-center gap-2">
          <span class="h-4 w-4 rounded-full border border-current border-t-transparent animate-spin" />
          Сохранение…
        </span>
        <span v-else>Сохранить</span>
      </Button>
    </div>
  </div>
</template>
