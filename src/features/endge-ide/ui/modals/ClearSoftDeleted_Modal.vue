<script setup lang="ts">
import type { DomainDocumentType } from '@endge/core'

import {
  ComponentType,
  DomainSectionType,
  Endge,
  FilterType,
  ParameterType,
  QueryType,
} from '@endge/core'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getSoftDeletedItems as getSoftDeletedFromTree } from '@/features/endge-ide/model/domain/domain-tree'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import { useDomainStore } from '@endge/vue'

const COMPONENT_SFC_TYPE = 'component-sfc' as DomainDocumentType

interface SoftDeletedItem {
  id: string
  name: string
  type?: DomainDocumentType
  sectionType: DomainSectionType
}

function getSoftDeletedItems(domainStore: ReturnType<typeof useDomainStore>): SoftDeletedItem[] {
  const softId = Endge.domain.getFolderByIdentity('soft-deleted')?.id ?? null
  const raw = getSoftDeletedFromTree(domainStore as any, softId, (domainStore.folders as any[]) ?? [])
  return raw.map(({ id, name, type, sectionType }) => ({ id, name, type, sectionType }))
}

function isInheritedOnlyFromView(
  entity: { inherited?: boolean; meta?: { inheritedFrom?: Array<{ docType?: string; docIdentity?: string }> } } | null,
  viewId: string,
): boolean {
  if (!entity?.inherited) return false
  const from = entity.meta?.inheritedFrom
  if (!Array.isArray(from) || from.length !== 1) return false
  const ref = from[0]
  return ref?.docType === 'view' && ref?.docIdentity === viewId
}

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const domainStore = useDomainStore()
const loading = ref(false)

const openModel = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const softDeletedList = computed(() => getSoftDeletedItems(domainStore))

const canClear = computed(() => softDeletedList.value.length > 0)

function close(): void {
  if (!loading.value) openModel.value = false
}

async function clearAll(): Promise<void> {
  const items = softDeletedList.value
  if (items.length === 0) {
    close()
    return
  }
  loading.value = true
  try {
    await EndgeIDE.runBusy((async () => {
    const nonViews = items.filter(i => i.sectionType !== DomainSectionType.View)
    const views = items.filter(i => i.sectionType === DomainSectionType.View)

    const closeTab = (id: string, docType: DomainDocumentType) => {
      EndgeIDE.tabs.closeTab(`${docType}-${id}`)
    }

    const supportedDocTypes = new Set<DomainDocumentType>([
      ComponentType.Table,
      ComponentType.DSL,
      COMPONENT_SFC_TYPE,
      QueryType.REST,
      QueryType.GraphQL,
      QueryType.Custom,
      ParameterType.DefaultParameter,
      FilterType.DefaultFilter as DomainDocumentType,
      'type',
      'primitive',
      'auth-profile',
    ])
    const deletableNonViews = nonViews.filter(i => i.type && supportedDocTypes.has(i.type))

    for (const item of deletableNonViews) {
      const type = item.type!
      await Endge.schema.deleteDocumentHard(item.id, type)
      if (type === ComponentType.Table || type === ComponentType.DSL) Endge.domain.removeComponent(item.id)
      else if (type === COMPONENT_SFC_TYPE) (Endge.domain as any).removeComponentSFC?.(item.id)
      else if (type === QueryType.REST || type === QueryType.GraphQL || type === QueryType.Custom) Endge.domain.removeQuery(item.id)
      else if (type === ParameterType.DefaultParameter) Endge.domain.removeParameter(item.id)
      else if (type === (FilterType.DefaultFilter as DomainDocumentType)) Endge.domain.removeFilter(item.id)
      else if (type === 'type' || type === 'primitive') Endge.domain.removeType(item.id)
      else if (type === 'auth-profile') Endge.domain.removeAuthProfile(item.id)
      closeTab(item.id, type)
    }

    for (const item of views) {
      const viewId = item.id
      const view = Endge.domain.getView(viewId)
      if (view) {
        const toDelete: { id: string; type: DomainDocumentType }[] = []
        if (view.filterId) {
          const f = Endge.domain.getFilter(view.filterId)
          if (f && isInheritedOnlyFromView(f, viewId)) toDelete.push({ id: String(view.filterId), type: FilterType.DefaultFilter as DomainDocumentType })
        }
        if (view.queryId) {
          const q = Endge.domain.getQuery(view.queryId)
          if (q && isInheritedOnlyFromView(q, viewId)) toDelete.push({ id: String(view.queryId), type: q.type })
        }
        if (view.componentId) {
          const c = Endge.domain.getComponent(view.componentId)
          if (c && isInheritedOnlyFromView(c, viewId)) toDelete.push({ id: String(view.componentId), type: c.type as DomainDocumentType })
        }
        for (const { id, type } of toDelete) {
          await Endge.schema.deleteDocumentHard(id, type)
          if (type === (FilterType.DefaultFilter as DomainDocumentType)) Endge.domain.removeFilter(id)
          else if (type === QueryType.REST || type === QueryType.GraphQL || type === QueryType.Custom) Endge.domain.removeQuery(id)
          else if (type === ComponentType.Table || type === ComponentType.DSL) Endge.domain.removeComponent(id)
          closeTab(id, type)
        }
      }
      await Endge.schema.deleteDocumentHard(viewId, 'view')
      Endge.domain.removeView(viewId)
      closeTab(viewId, 'view')
    }

    Endge.domain.notify()
    const totalDeleted = deletableNonViews.length + views.length
    toast.success('Папка «Удалённые» очищена', { description: `Удалено сущностей: ${totalDeleted}` })
    })())
    openModel.value = false
  } catch (e) {
    console.error(e)
    toast.error('Ошибка при очистке', { description: (e as Error)?.message })
  } finally {
    loading.value = false
  }
}

watch(() => props.open, (v) => {
  if (v) loading.value = false
})
</script>

<template>
  <Dialog :open="openModel" @update:open="openModel = $event">
    <DialogContent class="sm:max-w-md" @pointer-down-outside="close" @escape-key-down="close">
      <DialogHeader>
        <DialogTitle>Очистить все</DialogTitle>
      </DialogHeader>
      <p class="text-sm text-muted-foreground">
        Удалить все сущности из папки «Удалённые» навсегда? Это действие нельзя отменить.
      </p>
      <p v-if="canClear" class="text-sm">
        Будет удалено сущностей: <strong>{{ softDeletedList.length }}</strong>
      </p>
      <p v-else class="text-sm text-muted-foreground">
        В папке «Удалённые» нет сущностей.
      </p>
      <DialogFooter class="gap-2">
        <Button variant="outline" :disabled="loading" @click="close">
          Отмена
        </Button>
        <Button variant="destructive" :disabled="loading || !canClear" @click="clearAll">
          {{ loading ? 'Удаление…' : 'Очистить все' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
