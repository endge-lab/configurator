<script setup lang="ts">
import { Download, Loader2, Plus } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { configuratorReleases } from '@/features/configurator-releases'
import { Configurator } from '@/app'

const version = ref(0)
const identity = ref('')
const role = computed(() => Configurator.context.workspaceRole)
const canCreate = computed(() => role.value === 'editor' || role.value === 'admin')
const items = computed(() => { void version.value; return configuratorReleases.items })
const loading = computed(() => { void version.value; return configuratorReleases.loading })
const stop = configuratorReleases.subscribe(() => { version.value += 1 })

async function createRelease(): Promise<void> {
  const value = identity.value.trim()
  if (!value) return
  try {
    await configuratorReleases.create(value)
    identity.value = ''
    toast.success('Release создан', { description: value })
  }
  catch (error) { toast.error(error instanceof Error ? error.message : 'Не удалось создать release') }
}

onMounted(() => { void configuratorReleases.load() })
onBeforeUnmount(stop)
</script>

<template>
  <div class="flex h-full flex-col gap-3 p-3 text-sm">
    <form v-if="canCreate" class="flex gap-2" @submit.prevent="createRelease">
      <input v-model="identity" class="min-w-0 flex-1 rounded border bg-background px-2 py-1" placeholder="release identity">
      <button class="rounded border p-1.5 hover:bg-accent" :disabled="loading || !identity.trim()" title="Создать release">
        <Plus class="size-4" />
      </button>
    </form>
    <div v-if="loading" class="flex items-center gap-2 text-muted-foreground"><Loader2 class="size-4 animate-spin" /> Загрузка…</div>
    <div v-else-if="items.length === 0" class="text-muted-foreground">Релизов пока нет</div>
    <button v-for="release in items" :key="release.id" class="flex items-center justify-between rounded border p-2 text-left hover:bg-accent" @click="configuratorReleases.download(release.identity)">
      <span><span class="block font-medium">{{ release.displayName }}</span><span class="text-xs text-muted-foreground">head {{ release.headSequence }}</span></span>
      <Download class="size-4" />
    </button>
  </div>
</template>
