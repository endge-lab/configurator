<script setup lang="ts">
import type { RPageEditor } from '@/features/endge-admin/domain/entities/RPageEditor.ts'

import { ComponentType, DomainSectionType, FilterType } from '@endge/core'
import { useDomainStore } from '@endge/vue'
import { computed, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'
import BehaviorBindingEditor from '@/features/endge-admin/ui/components/BehaviorBindingEditor.vue'
import PresentationBindingEditor from '@/features/endge-admin/ui/components/PresentationBindingEditor.vue'
import TemplatePreviewGrid from '@/features/endge-admin/ui/components/TemplatePreviewGrid.vue'

const props = defineProps<{
  tabContext?: { editor?: RPageEditor }
}>()

const editor = computed<RPageEditor | null>(() => props.tabContext?.editor ?? null)

const domainStore = useDomainStore()

/** Шаблон страницы по выбранному templateId. */
const pageTemplate = computed(() => {
  const templateId = editor.value?.templateId
  if (templateId == null)
    return null
  const list = domainStore.pageTemplates ?? []
  return list.find((t: any) => t?.id === templateId) ?? null
})

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
  await EndgeAdmin.tabs.save()
}

interface DomainEntity {
  id?: string | number | null
  identity?: string | number | null
  name?: string | null
  displayName?: string | null
  type?: string | null
  meta?: {
    inheritedFrom?: Array<{
      docType?: string
      docIdentity?: string | number | null
    }>
  } | null
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

function getInheritedViewRefs(entity: DomainEntity | null | undefined): Set<string> {
  const refs = new Set<string>()
  const inheritedFrom = entity?.meta?.inheritedFrom
  if (!Array.isArray(inheritedFrom))
    return refs
  for (const ref of inheritedFrom) {
    if (ref?.docType !== 'view')
      continue
    const key = normalizeKey(ref.docIdentity)
    if (key)
      refs.add(key)
  }
  return refs
}

const selectedController = computed(() => {
  const controllerId = editor.value?.controllerId
  if (controllerId == null)
    return null
  return (domainStore.views ?? []).find((view: any) => view?.id === controllerId) ?? null
})

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

function isEntityChildOfController(entity: DomainEntity, sectionType: DomainSectionType): boolean {
  const controller = selectedController.value as DomainEntity | null
  if (!controller)
    return false

  const controllerKeys = getEntityKeys(controller)
  const inheritedViewRefs = getInheritedViewRefs(entity)
  for (const ref of inheritedViewRefs) {
    if (controllerKeys.has(ref))
      return true
  }

  const entityKeys = getEntityKeys(entity)
  if (sectionType === DomainSectionType.Component) {
    const linkedComponent = normalizeKey((controller as any).componentId)
    if (linkedComponent && entityKeys.has(linkedComponent))
      return true
  }
  if (sectionType === DomainSectionType.Filters) {
    const linkedFilter = normalizeKey((controller as any).filterId)
    if (linkedFilter && entityKeys.has(linkedFilter))
      return true
  }

  return false
}

function resolveDropPayload(sectionType: DomainSectionType, id: string):
  | { entityType: 'component' | 'filter', entityIdentity: string, entityId: number | null }
  | null {
  if (sectionType !== DomainSectionType.Component && sectionType !== DomainSectionType.Filters)
    return null

  if (!selectedController.value) {
    toast.error('Сначала выберите контроллер страницы')
    return null
  }

  const entity = getEntityByDrop(sectionType, id)
  if (!entity) {
    toast.error('Сущность не найдена в домене')
    return null
  }

  if (!isEntityChildOfController(entity, sectionType)) {
    toast.error('Сущность не принадлежит выбранному контроллеру')
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
          iconClass = compactIconClass(EndgeAdmin.tabs.getDocumentIcon((entity?.type ?? ComponentType.Table) as any))
        }
        else if (block.entityType === 'filter') {
          iconClass = compactIconClass(EndgeAdmin.tabs.getDocumentIcon((entity?.type ?? FilterType.DefaultFilter) as any))
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
        <Button size="sm" @click="save">
          Сохранить
        </Button>
      </div>
    </div>

    <ScrollArea class="flex-1 px-4 py-3">
      <div class="max-w-3xl">
        <Card class="p-4 space-y-3">
          <div class="font-semibold">
            Превью шаблона
          </div>
          <p v-if="!editor?.templateId" class="text-xs text-muted-foreground">
            Выберите шаблон страницы в инспекторе, чтобы отобразить превью.
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

        <Card class="p-4">
          <BehaviorBindingEditor
            :editor-model="editor"
            owner-type="page"
            :owner-id="editor?.id ?? null"
            target-type="page"
            :target-id="editor?.id ?? null"
            document-type="page"
          />
        </Card>
        <Card class="p-4 mt-3">
          <PresentationBindingEditor
            :editor-model="editor"
            owner-type="page"
            :owner-id="editor?.id ?? null"
            target-type="page"
            :target-id="editor?.id ?? null"
          />
        </Card>
      </div>
    </ScrollArea>
  </div>
</template>
