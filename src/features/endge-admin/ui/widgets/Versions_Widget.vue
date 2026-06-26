<script setup lang="ts">
import type { RVersion } from '@endge/core'

import { Endge } from '@endge/core'
import { GitBranch, Plus } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'

const versions = ref<RVersion[]>([])
const loading = ref(false)

const modals = EndgeAdmin.modals
const tabs = EndgeAdmin.tabs

async function loadVersions(): Promise<void> {
  loading.value = true
  try {
    await Endge.schema.loadVersionsList()
    versions.value = Endge.domain.getVersions()
  }
  finally {
    loading.value = false
  }
}

watch(() => modals.isCreateVersionOpen.value, (open, prev) => {
  if (prev && !open) loadVersions()
})

onMounted(() => {
  loadVersions()
})

function openCreate(): void {
  modals.openCreateVersion()
}

function openVersion(v: RVersion): void {
  tabs.openVersion(v.id)
}

const isEmpty = computed(() => versions.value.length === 0)
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="p-3 border-b flex items-center justify-between shrink-0">
      <Button class="w-full" size="sm" variant="outline" @click="openCreate">
        <Plus class="size-4 mr-1" />
        Создать
      </Button>
    </div>
    <ScrollArea class="flex-1">
      <div class="p-2">
        <div v-if="loading" class="py-4 text-center text-sm text-muted-foreground">
          Загрузка…
        </div>
        <div v-else-if="isEmpty" class="py-4 text-center text-sm text-muted-foreground">
          Нет сохранённых версий
        </div>
        <ul v-else class="space-y-1">
          <li
            v-for="v in versions"
            :key="v.id"
            class="rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors"
            @click="openVersion(v)"
          >
            <div class="font-medium">{{ v.identity }}</div>
            <div v-if="v.description" class="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {{ v.description }}
            </div>
          </li>
        </ul>
      </div>
    </ScrollArea>
  </div>
</template>
