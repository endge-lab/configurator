<script setup lang="ts">
import type { RFacet } from '@endge/core'

import { Endge } from '@endge/core'
import { ArchiveRestore, GripVertical, icons, Layers3, Loader2, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import LucideAppearancePicker from '@/features/endge-ide/ui/components/LucideAppearancePicker.vue'

const facets = ref<RFacet[]>([])
const includeDeleted = ref(false)
const loading = ref(false)
const draggedIdentity = ref<string | null>(null)
const dialog = reactive({
  open: false,
  originalIdentity: '',
  identity: '',
  displayName: '',
  icon: 'Layers',
  color: '#2563eb',
  meta: {} as Record<string, unknown>,
  documentCount: 0,
  saving: false,
})

const visibleFacets = computed(() => facets.value
  .filter(facet => includeDeleted.value ? facet.deletedAt != null : facet.deletedAt == null)
  .sort((left, right) => left.position - right.position || left.identity.localeCompare(right.identity)))

const unsubscribeDomain = Endge.domain.subscribe(() => {
  if (!loading.value) {
    void refresh()
  }
})

onMounted(refresh)
onUnmounted(unsubscribeDomain)

async function refresh(): Promise<void> {
  if (loading.value) {
    return
  }
  loading.value = true
  try {
    facets.value = await Endge.domainRepository.listFacets(true)
  }
  catch (error) {
    toast.error('Не удалось загрузить фасеты', { description: message(error) })
  }
  finally {
    loading.value = false
  }
}

function openCreate(): void {
  Object.assign(dialog, {
    open: true,
    originalIdentity: '',
    identity: '',
    displayName: '',
    icon: 'Layers',
    color: '#2563eb',
    meta: {},
    documentCount: 0,
    saving: false,
  })
}

function openEdit(facet: RFacet): void {
  Object.assign(dialog, {
    open: true,
    originalIdentity: facet.identity,
    identity: facet.identity,
    displayName: facet.displayName,
    icon: facet.icon,
    color: facet.color,
    meta: { ...facet.meta },
    documentCount: facet.documentCount,
    saving: false,
  })
}

async function saveFacet(): Promise<void> {
  dialog.saving = true
  try {
    const document = {
      identity: dialog.identity.trim(),
      displayName: dialog.displayName.trim(),
      icon: dialog.icon,
      color: dialog.color.toLowerCase(),
      meta: dialog.meta,
    }
    if (dialog.originalIdentity) {
      await Endge.domainRepository.updateFacet(dialog.originalIdentity, document)
    }
    else {
      await Endge.domainRepository.createFacet(document)
    }
    dialog.open = false
    await refresh()
    toast.success(dialog.originalIdentity ? 'Фасет обновлён' : 'Фасет создан')
  }
  catch (error) {
    toast.error('Не удалось сохранить фасет', { description: message(error) })
  }
  finally {
    dialog.saving = false
  }
}

async function deleteFacet(facet: RFacet): Promise<void> {
  if (facet.documentCount > 0) {
    return
  }
  try {
    await Endge.domainRepository.deleteFacet(facet.identity)
    await refresh()
    toast.success('Фасет перемещён в удалённые')
  }
  catch (error) {
    toast.error('Не удалось удалить фасет', { description: message(error) })
  }
}

async function restoreFacet(facet: RFacet): Promise<void> {
  try {
    await Endge.domainRepository.restoreFacet(facet.identity)
    await refresh()
    toast.success('Фасет восстановлен')
  }
  catch (error) {
    toast.error('Не удалось восстановить фасет', { description: message(error) })
  }
}

function startDrag(identity: string): void {
  draggedIdentity.value = identity
}

async function dropBefore(targetIdentity: string): Promise<void> {
  const sourceIdentity = draggedIdentity.value
  draggedIdentity.value = null
  if (!sourceIdentity || sourceIdentity === targetIdentity) {
    return
  }
  const previous = facets.value.slice()
  const active = facets.value.filter(facet => facet.deletedAt == null).sort((a, b) => a.position - b.position)
  const from = active.findIndex(facet => facet.identity === sourceIdentity)
  const to = active.findIndex(facet => facet.identity === targetIdentity)
  if (from < 0 || to < 0) {
    return
  }
  const [moved] = active.splice(from, 1)
  active.splice(to, 0, moved!)
  active.forEach((facet, index) => {
    facet.position = index
  })
  facets.value = [...active, ...facets.value.filter(facet => facet.deletedAt != null)]
  try {
    facets.value = [
      ...await Endge.domainRepository.reorderFacets(active.map(facet => facet.identity)),
      ...facets.value.filter(facet => facet.deletedAt != null),
    ]
  }
  catch (error) {
    facets.value = previous
    toast.error('Порядок фасетов не сохранён', { description: message(error) })
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="mx-auto flex h-full w-full max-w-4xl min-h-0 flex-col">
      <header class="flex shrink-0 items-center justify-end gap-3 pb-3">
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch v-model:checked="includeDeleted" />{{ $t('facets.deleted') }}
          </label>
          <Button size="sm" class="gap-2" @click="openCreate">
            <Plus class="size-4" />{{ $t('facets.createFacet') }}
          </Button>
        </div>
      </header>

      <div v-if="loading" class="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 class="mr-2 size-4 animate-spin" />{{ $t('facets.loadingFacets') }}
      </div>
      <div v-else-if="!visibleFacets.length" class="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
        <Layers3 class="size-8 opacity-50" />
        <p class="text-sm">
          {{ includeDeleted ? $t('facets.noDeletedFacets') : $t('facets.emptyWorkspace') }}
        </p>
        <p v-if="!includeDeleted" class="max-w-md text-xs">
          {{ $t('facets.emptyHint') }}
        </p>
      </div>
      <div v-else class="min-h-0 flex-1 overflow-y-auto">
        <div
          v-for="facet in visibleFacets"
          :key="facet.id"
          class="mb-2 grid grid-cols-[2rem_2.25rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border bg-background px-2 py-2 last:mb-0"
          :draggable="!includeDeleted"
          @dragstart="startDrag(facet.identity)"
          @dragover.prevent
          @drop.prevent="dropBefore(facet.identity)"
        >
          <GripVertical class="size-4 cursor-grab text-muted-foreground" :class="includeDeleted ? 'invisible' : ''" />
          <div class="flex size-8 items-center justify-center rounded-md border" :style="{ color: facet.color, backgroundColor: `${facet.color}18` }">
            <component :is="(icons as any)[facet.icon] || Layers3" class="size-4" />
          </div>
          <div class="min-w-0">
            <div class="truncate text-sm font-medium">
              {{ facet.displayName }}
            </div>
            <div class="truncate font-mono text-[11px] text-muted-foreground">
              {{ `${facet.identity} · ${$t('facets.documentCount', { count: facet.documentCount })}` }}
            </div>
          </div>
          <div class="flex items-center gap-1">
            <Button v-if="facet.deletedAt == null" size="icon" variant="ghost" class="size-8" title="Изменить" @click="openEdit(facet)">
              <Pencil class="size-4" />
            </Button>
            <Button
              v-if="facet.deletedAt == null"
              size="icon"
              variant="ghost"
              class="size-8 text-destructive"
              :disabled="facet.documentCount > 0"
              :title="facet.documentCount > 0 ? `Сначала удалите ${facet.documentCount} активных документов` : 'Удалить фасет'"
              @click="deleteFacet(facet)"
            >
              <Trash2 class="size-4" />
            </Button>
            <Button v-else size="sm" variant="outline" class="gap-2" @click="restoreFacet(facet)">
              <ArchiveRestore class="size-4" />{{ $t('facets.restore') }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <Dialog v-model:open="dialog.open">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ dialog.originalIdentity ? $t('facets.editFacet') : $t('facets.newFacet') }}</DialogTitle>
          <DialogDescription>{{ $t('facets.dialogDescription') }}</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-2">
          <div class="space-y-2">
            <Label for="facet-identity">{{ $t('facets.identity') }}</Label>
            <Input id="facet-identity" v-model="dialog.identity" :disabled="dialog.documentCount > 0" :placeholder="$t('facets.identityPlaceholder')" />
            <p v-if="dialog.documentCount > 0" class="text-xs text-muted-foreground">
              {{ $t('facets.identityLocked', { count: dialog.documentCount }) }}
            </p>
          </div>
          <div class="space-y-2">
            <Label for="facet-display-name">{{ $t('facets.name') }}</Label><Input id="facet-display-name" v-model="dialog.displayName" :placeholder="$t('facets.namePlaceholder')" />
          </div>
          <div class="space-y-2">
            <Label>{{ $t('facets.appearance') }}</Label><LucideAppearancePicker v-model:icon="dialog.icon" v-model:color="dialog.color" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" :disabled="dialog.saving" @click="dialog.open = false">
            {{ $t('facets.cancel') }}
          </Button>
          <Button :disabled="dialog.saving || !dialog.identity.trim() || !dialog.displayName.trim()" @click="saveFacet">
            <Loader2 v-if="dialog.saving" class="mr-2 size-4 animate-spin" />{{ $t('facets.save') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
