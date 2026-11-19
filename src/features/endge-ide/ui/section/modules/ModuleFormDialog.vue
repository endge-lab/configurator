<script setup lang="ts">
import type { CatalogModuleDetail } from '@/features/endge-ide/adapters/backend/ServiceBackendModulesHttp_Adapter'
import { Loader2 } from 'lucide-vue-next'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'

const props = defineProps<{ mode: 'create' | 'edit' | 'publish', entry?: CatalogModuleDetail }>()
const emit = defineEmits<{ saved: [entry: CatalogModuleDetail], close: [] }>()
const { t } = useI18n()
const catalog = EndgeIDE.moduleCatalog
const busy = ref(false)
const error = ref('')
const identity = ref('')
const name = ref(props.mode === 'edit' ? props.entry?.name ?? '' : '')
const description = ref(props.mode === 'edit' ? props.entry?.description ?? '' : '')
const archive = shallowRef<File>()
const title = computed(() => {
  if (props.mode === 'create') {
    return t('moduleCatalog.create')
  }
  return props.mode === 'edit' ? t('moduleCatalog.edit') : t('moduleCatalog.addVersion')
})

function selectArchive(event: Event): void {
  archive.value = (event.target as HTMLInputElement).files?.[0]
}

async function submit(): Promise<void> {
  if (busy.value) {
    return
  }
  busy.value = true
  error.value = ''
  try {
    const entry = props.entry
    const metadata = { name: name.value.trim(), description: description.value.trim() }
    if (props.mode === 'create' && archive.value) {
      emit('saved', await catalog.create({ identity: identity.value, ...metadata }, archive.value))
    }
    else if (props.mode === 'edit' && entry) {
      const updated = await catalog.edit({ ...entry, ...metadata })
      emit('saved', { ...entry, ...updated })
    }
    else if (props.mode === 'publish' && entry && archive.value) {
      const version = await catalog.transport.publish(entry.identity, archive.value)
      void catalog.refresh()
      emit('saved', {
        ...entry,
        versions: [version, ...entry.versions.filter(item => item.version !== version.version)],
      })
    }
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <Dialog :open="true" @update:open="value => !value && !busy && emit('close')">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ t('moduleCatalog.description') }}</DialogDescription>
      </DialogHeader>
      <p v-if="error" role="alert" class="text-sm text-destructive">
        {{ error }}
      </p>
      <form class="grid gap-3" @submit.prevent="submit">
        <label v-if="mode === 'create'" class="grid gap-1 text-sm">
          {{ t('moduleCatalog.identity') }}
          <Input v-model="identity" required maxlength="128" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="slot-table-preview" />
        </label>
        <label v-if="mode !== 'publish'" class="grid gap-1 text-sm">
          {{ t('moduleCatalog.name') }}
          <Input v-model="name" required maxlength="160" />
        </label>
        <label v-if="mode !== 'publish'" class="grid gap-1 text-sm">
          {{ t('moduleCatalog.details') }}
          <Textarea v-model="description" maxlength="4000" />
        </label>
        <label v-if="mode !== 'edit'" class="grid gap-1 text-sm">
          {{ t('moduleCatalog.archive') }}
          <Input type="file" accept=".zip,application/zip" required @change="selectArchive" />
        </label>
        <div class="flex justify-end gap-2">
          <Button type="button" variant="outline" :disabled="busy" @click="emit('close')">
            {{ t('moduleCatalog.cancel') }}
          </Button>
          <Button type="submit" :disabled="busy || (mode !== 'publish' && !name.trim())">
            <Loader2 v-if="busy" class="size-4 animate-spin" />
            {{ mode === 'edit' ? t('moduleCatalog.save') : t('moduleCatalog.upload') }}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
