<script setup lang="ts">
import type { ModuleReference } from '@endge/core'
import type { CatalogModuleDetail } from '@/features/endge-ide/adapters/backend/ServiceBackendModulesHttp_Adapter'
import { isModuleReference } from '@endge/core'
import { unzipSync } from 'fflate'
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
const name = ref(props.mode === 'edit' ? props.entry?.name ?? '' : '')
const description = ref(props.mode === 'edit' ? props.entry?.description ?? '' : '')
const archive = shallowRef<File>()
const manifest = shallowRef<ModuleReference>()
const archiveError = ref('')
const canSubmit = computed(() => !busy.value
  && (props.mode === 'publish' || !!name.value.trim())
  && (props.mode === 'edit' || (!!manifest.value && !archiveError.value)))
const title = computed(() => {
  if (props.mode === 'create') {
    return t('moduleCatalog.create')
  }
  return props.mode === 'edit' ? t('moduleCatalog.edit') : t('moduleCatalog.addVersion')
})

async function readManifest(file: File): Promise<ModuleReference> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const files = unzipSync(bytes, {
    filter: entry => entry.name === 'manifest.json' && entry.originalSize <= 16 * 1024,
  })
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(files['manifest.json']))
  if (!value || typeof value !== 'object'
    || !('identity' in value) || typeof value.identity !== 'string'
    || !('version' in value) || typeof value.version !== 'string'
    || !isModuleReference(value.identity, value.version)
    || !('formatVersion' in value) || value.formatVersion !== 1
    || !('hostApi' in value) || value.hostApi !== 1) {
    throw new Error('Invalid module manifest')
  }
  return { identity: value.identity, version: value.version }
}

async function selectArchive(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  archive.value = file
  manifest.value = undefined
  archiveError.value = ''
  error.value = ''
  if (!file) {
    return
  }
  if (!file.size || file.size > 15 * 1024 * 1024) {
    archiveError.value = t('moduleCatalog.invalidArchiveSize')
    return
  }
  try {
    const candidate = await readManifest(file)
    if (archive.value !== file) {
      return
    }
    manifest.value = candidate
    if (props.mode === 'publish' && candidate.identity !== props.entry?.identity) {
      archiveError.value = t('moduleCatalog.archiveIdentityMismatch', {
        actual: candidate.identity,
        expected: props.entry?.identity,
      })
    }
  }
  catch {
    if (archive.value === file) {
      archiveError.value = t('moduleCatalog.invalidArchiveManifest')
    }
  }
}

async function submit(): Promise<void> {
  if (!canSubmit.value) {
    return
  }
  busy.value = true
  error.value = ''
  try {
    const entry = props.entry
    const metadata = { name: name.value.trim(), description: description.value.trim() }
    if (props.mode === 'create' && archive.value && manifest.value) {
      emit('saved', await catalog.create({ identity: manifest.value.identity, ...metadata }, archive.value))
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
          <Input type="file" accept=".zip,application/zip" required :disabled="busy" @change="selectArchive" />
        </label>
        <dl v-if="manifest" class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
          <dt class="text-muted-foreground">
            {{ t('moduleCatalog.identity') }}
          </dt>
          <dd class="break-all font-mono">
            {{ manifest.identity }}
          </dd>
          <dt class="text-muted-foreground">
            {{ t('moduleCatalog.version') }}
          </dt>
          <dd class="break-all font-mono">
            {{ manifest.version }}
          </dd>
        </dl>
        <p v-if="archiveError" role="alert" class="text-sm text-destructive">
          {{ archiveError }}
        </p>
        <div class="flex justify-end gap-2">
          <Button type="button" variant="outline" :disabled="busy" @click="emit('close')">
            {{ t('moduleCatalog.cancel') }}
          </Button>
          <Button type="submit" :disabled="!canSubmit">
            <Loader2 v-if="busy" class="size-4 animate-spin" />
            {{ mode === 'edit' ? t('moduleCatalog.save') : t('moduleCatalog.upload') }}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
