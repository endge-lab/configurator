<script setup lang="ts">
import type { RPageEditor } from '@/features/endge-ide/domain/entities/RPageEditor.ts'

import { ComponentType, DomainSectionType, FilterType } from '@endge/core'
import { useDomainStore } from '@endge/vue'
import { computed, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import SaveDocumentButton from '@/features/endge-ide/ui/components/SaveDocumentButton.vue'
import TemplatePreviewGrid from '@/features/endge-ide/ui/components/TemplatePreviewGrid.vue'

const props = defineProps<{
  tabContext?: { editor?: RPageEditor }
}>()

const editor = computed<RPageEditor | null>(() => props.tabContext?.editor ?? null)
const documentModel = computed(() => EndgeIDE.tabs.documentModel.value as { isSystem?: boolean } | null)
const isSystem = computed(() => documentModel.value?.isSystem === true)

const domainStore = useDomainStore()

/** Шаблон страницы по выбранному templateId. */
const pageTemplate = computed(() => {
  const templateId = editor.value?.templateId
  if (templateId == null)
    return null
  const list = domainStore.pageTemplates ?? []
  return list.find((t: any) => t?.id === templateId) ?? null
})
const templateOptions = computed(() =>
  (domainStore.pageTemplates ?? [])
    .map((template: any) => ({
      value: template?.id != null ? String(template.id) : '',
      label: String(template?.name ?? template?.displayName ?? template?.identity ?? template?.id ?? ''),
    }))
    .filter((option: { value: string, label: string }) => option.value),
)

function setTemplate(value: string | null): void {
  if (!editor.value)
    return
  const normalized = String(value ?? '').trim()
  editor.value.templateId = normalized && Number.isFinite(Number(normalized))
    ? Number(normalized)
    : null
}

/** Синхронизация областей редактора с областями шаблона при смене шаблона или загрузке. */
watch(
  [editor, pageTemplate],
  () => {
    const ed = editor.value
    const tpl = pageTemplate.value
    if (!ed || !tpl?.areas?.length)
      return
    ed.syncAreasFromTemplate(tpl.areas)
  },
  { immediate: true },
)

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}

interface DomainEntity {
  id?: string | number | null
  identity?: string | number | null
  name?: string | null
  displayName?: string | null
  type?: string | null
}

interface AddBlockPayload {
  entityType: string
  entityIdentity: string
  entityId?: number | null
}

interface PageAreaBlockRef {
  entityType?: string | null
  entityIdentity?: string | null
  entityId?: number | null
}

interface PreviewDropPayload {
  slotId: string
  id: string
  sectionType: DomainSectionType
}

function normalizeKey(value: unknown): string {
  return String(value ?? '').trim()
}

function getEntityKeys(entity: DomainEntity | null | undefined): Set<string> {
  const keys = new Set<string>()
  const id = normalizeKey(entity?.id)
  const identity = normalizeKey(entity?.identity)
  if (id)
    keys.add(id)
  if (identity)
    keys.add(identity)
  return keys
}

function compactIconClass(iconClass: string): string {
  return `${iconClass
    .replace(/\btext-(xl|2xl)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()} text-sm`
}

function getEntityByDrop(sectionType: DomainSectionType, id: string): DomainEntity | null {
  const normalizedId = normalizeKey(id)
  if (!normalizedId)
    return null
  if (sectionType === DomainSectionType.Component) {
    return (domainStore.components ?? []).find((component: any) => {
      const keys = getEntityKeys(component as DomainEntity)
      return keys.has(normalizedId)
    }) ?? null
  }
  if (sectionType === DomainSectionType.Filters) {
    return (domainStore.filters ?? []).find((filter: any) => {
      const keys = getEntityKeys(filter as DomainEntity)
      return keys.has(normalizedId)
    }) ?? null
  }
  return null
}

function resolveDropPayload(sectionType: DomainSectionType, id: string):
  | { entityType: 'component' | 'filter', entityIdentity: string, entityId: number | null }
  | null {
  if (sectionType !== DomainSectionType.Component && sectionType !== DomainSectionType.Filters)
    return null

  const entity = getEntityByDrop(sectionType, id)
  if (!entity) {
    toast.error('Сущность не найдена в домене')
    return null
  }

  const entityIdentity = normalizeKey(entity.identity) || normalizeKey(entity.id) || normalizeKey(id)
  const entityId = typeof entity.id === 'number' ? entity.id : null
  return {
    entityType: sectionType === DomainSectionType.Filters ? 'filter' : 'component',
    entityIdentity,
    entityId,
  }
}

function addBlockToArea(areaSlotId: string, payload: AddBlockPayload): void {
  const ed = editor.value
  if (!ed || !Array.isArray(ed.areas))
    return

  const area = ed.areas.find(a => a.slotId === areaSlotId)
  if (!area)
    return

  if (!Array.isArray(area.blocks))
    area.blocks = []

  const key = `${payload.entityType}:${payload.entityIdentity}`
  if (area.blocks.some(b => b.key === key))
    return

  area.blocks.push({
    key,
    entityType: payload.entityType,
    entityId: payload.entityId ?? null,
    entityIdentity: payload.entityIdentity,
  })
}

function removeBlock(areaSlotId: string, blockKey: string): void {
  const ed = editor.value
  if (!ed || !Array.isArray(ed.areas))
    return
  const area = ed.areas.find(a => a.slotId === areaSlotId)
  if (!area || !Array.isArray(area.blocks))
    return
  area.blocks = area.blocks.filter(b => b.key !== blockKey)
}

function getBlockEntity(block: PageAreaBlockRef): DomainEntity | null {
  const byIdentity = normalizeKey(block.entityIdentity)
  const byId = normalizeKey(block.entityId)

  if (block.entityType === 'component') {
    return (domainStore.components ?? []).find((component: any) => {
      const keys = getEntityKeys(component as DomainEntity)
      return (byIdentity && keys.has(byIdentity)) || (byId && keys.has(byId))
    }) ?? null
  }

  if (block.entityType === 'filter') {
    return (domainStore.filters ?? []).find((filter: any) => {
      const keys = getEntityKeys(filter as DomainEntity)
      return (byIdentity && keys.has(byIdentity)) || (byId && keys.has(byId))
    }) ?? null
  }

  return null
}

const previewAreas = computed(() => {
  return (editor.value?.areas ?? []).map((area) => {
    return {
      slotId: area.slotId,
      blocks: (area.blocks ?? []).map((block) => {
        const entity = getBlockEntity(block)
        const name = entity?.displayName ?? entity?.name ?? block.entityIdentity ?? block.key
        const identity = normalizeKey(entity?.identity) || normalizeKey(block.entityIdentity) || normalizeKey(entity?.id)
        const idValue = entity?.id ?? block.entityId ?? null

        let iconClass = 'ti ti-cube text-primary text-sm'
        if (block.entityType === 'component') {
          iconClass = compactIconClass(EndgeIDE.tabs.getDocumentIcon((entity?.type ?? ComponentType.Table) as any))
        }
        else if (block.entityType === 'filter') {
          iconClass = compactIconClass(EndgeIDE.tabs.getDocumentIcon((entity?.type ?? FilterType.DefaultFilter) as any))
        }

        return {
          key: block.key,
          entityType: block.entityType,
          entityIdentity: identity || block.entityIdentity || block.key,
          entityId: idValue,
          displayName: name,
          iconClass,
        }
      }),
    }
  })
})

function handlePreviewDrop(payload: PreviewDropPayload): void {
  const normalizedId = normalizeKey(payload.id)
  if (!normalizedId)
    return
  const resolved = resolveDropPayload(payload.sectionType, normalizedId)
  if (!resolved)
    return
  addBlockToArea(payload.slotId, resolved)
}

const previewAreaLabels = computed(() =>
  pageTemplate.value?.areas?.map((a: any) => ({
    identity: a.identity,
    title: a.title ?? a.identity,
  })) ?? [],
)
</script>

<template>
  <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
  <div class="w-full h-full flex flex-col min-h-0">
    <div class="p-3 border-b flex items-center justify-between gap-3 shrink-0">
      <div class="text-lg font-semibold truncate">
        Страница - {{ editor?.displayName ?? '-' }}
      </div>
      <div class="flex items-center gap-2">
        <SaveDocumentButton :loading="EndgeIDE.busy.value" :disabled="isSystem" @click="save" />
      </div>
    </div>

    <ScrollArea class="flex-1 px-4 py-3">
      <div class="max-w-3xl">
        <Card class="mb-4 p-4 space-y-4">
          <div class="font-semibold">Основное</div>
          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <Label>Identity</Label>
              <Input v-model="editor!.identity" :disabled="isSystem" placeholder="page.schedule" />
            </div>
            <div class="space-y-2">
              <Label>Название</Label>
              <Input v-model="editor!.displayName" :disabled="isSystem" placeholder="Расписание" />
            </div>
            <div class="space-y-2">
              <Label>routeName</Label>
              <Input v-model="editor!.routeName" :disabled="isSystem" placeholder="schedule" />
            </div>
            <div class="space-y-2">
              <Label>routePath</Label>
              <Input v-model="editor!.routePath" :disabled="isSystem" placeholder="/schedule" />
            </div>
          </div>
          <div class="space-y-2">
            <Label>Описание</Label>
            <Textarea v-model="editor!.description" :disabled="isSystem" :rows="2" />
          </div>
          <div class="space-y-2">
            <Label>Шаблон страницы</Label>
            <SearchableSelect
              :model-value="editor?.templateId != null ? String(editor.templateId) : null"
              :options="templateOptions"
              :disabled="isSystem"
              placeholder="Выберите шаблон страницы"
              trigger-class="w-full h-9"
              @update:model-value="value => setTemplate(value != null ? String(value) : null)"
            />
          </div>
          <div class="flex items-center justify-between gap-3">
            <Label>Включена</Label>
            <Switch
              :checked="editor?.enabled ?? true"
              :disabled="isSystem"
              @update:checked="value => editor && (editor.enabled = !!value)"
            />
          </div>
        </Card>
        <Card class="p-4 space-y-3">
          <div class="font-semibold">
            Превью шаблона
          </div>
          <p v-if="!editor?.templateId" class="text-xs text-muted-foreground">
            Выберите шаблон страницы во вкладке «Основное», чтобы отобразить превью.
          </p>
          <p v-else-if="!pageTemplate?.preview?.rows?.length" class="text-xs text-muted-foreground">
            У выбранного шаблона нет настроенного превью.
          </p>
          <div v-else class="max-w-lg">
            <p class="mb-2 text-xs text-muted-foreground">
              Перетащите в область компонент или фильтр дочернего уровня выбранного контроллера.
            </p>
            <TemplatePreviewGrid
              :preview="pageTemplate?.preview ?? null"
              :area-labels="previewAreaLabels"
              :page-mode="true"
              :page-areas="previewAreas"
              @drop="handlePreviewDrop"
              @remove-block="({ slotId, blockKey }) => removeBlock(slotId, blockKey)"
            />
          </div>
        </Card>

      </div>
    </ScrollArea>
  </div>
</template>
