<script setup lang="ts">
import type { CatalogModule, CatalogModuleDetail } from '@/features/endge-ide/adapters/backend/ServiceBackendModulesHttp_Adapter'
import { Archive, Download, Loader2, Plus } from 'lucide-vue-next'
import { ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ServiceBackendModulesHttpAdapter } from '@/features/endge-ide/adapters/backend/ServiceBackendModulesHttp_Adapter'
import { getEndgeBackendConfig } from '@/features/endge-ide/config/endge-backend'

const props = defineProps<{ canPublish: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const { t } = useI18n()
const modules = ref<CatalogModule[]>([])
const selection = ref<CatalogModuleDetail | null>(null)
const client = shallowRef<ServiceBackendModulesHttpAdapter>()
const busy = ref(false)
const error = ref('')
const mode = ref<'list' | 'create' | 'edit' | 'publish'>('list')
const identity = ref('')
const name = ref('')
const description = ref('')
const archive = shallowRef<File>()

function changeMode(next: typeof mode.value) {
  mode.value = next
  error.value = ''
  archive.value = undefined
  identity.value = next === 'edit' ? selection.value?.identity ?? '' : ''
  name.value = next === 'edit' ? selection.value?.name ?? '' : ''
  description.value = next === 'edit' ? selection.value?.description ?? '' : ''
}

async function run(task: () => Promise<void>) {
  if (busy.value) {
    return
  }
  busy.value = true
  error.value = ''
  try {
    await task()
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
  finally {
    busy.value = false
  }
}

async function load() {
  if (client.value) {
    modules.value = await client.value.list()
  }
}

function select(identity: string) {
  void run(async () => {
    if (client.value) {
      selection.value = await client.value.detail(identity)
      changeMode('list')
    }
  })
}

function submit() {
  void run(async () => {
    const transport = client.value
    if (!transport || !props.canPublish) {
      return
    }
    if (mode.value === 'create' && archive.value) {
      selection.value = await transport.create({ identity: identity.value, name: name.value, description: description.value }, archive.value)
    }
    else if (mode.value === 'edit' && selection.value) {
      const saved = await transport.patch({ ...selection.value, name: name.value, description: description.value })
      selection.value = { ...selection.value, ...saved }
    }
    else if (mode.value === 'publish' && selection.value && archive.value) {
      const published = await transport.publish(selection.value.identity, archive.value)
      const versions = selection.value.versions.filter(entry => entry.version !== published.version)
      selection.value = { ...selection.value, versions: [published, ...versions] }
    }
    changeMode('list')
    await load()
  })
}

function selectArchive(event: Event) {
  archive.value = (event.target as HTMLInputElement).files?.[0]
}

watch(open, (value) => {
  if (value) {
    void run(async () => {
      client.value = new ServiceBackendModulesHttpAdapter(getEndgeBackendConfig().activeBackendURL)
      selection.value = null
      modules.value = []
      changeMode('list')
      await load()
    })
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ t('moduleCatalog.title') }}</DialogTitle>
        <DialogDescription>{{ t('moduleCatalog.description') }}</DialogDescription>
      </DialogHeader>
      <p v-if="error" role="alert" class="text-sm text-destructive">
        {{ error }}
      </p>
      <form v-if="mode !== 'list'" class="grid gap-3" @submit.prevent="submit">
        <label v-if="mode === 'create'" class="grid gap-1 text-sm">
          {{ t('moduleCatalog.identity') }}
          <Input v-model="identity" required maxlength="128" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="slot-ui-preview" />
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
          <Button type="button" variant="outline" :disabled="busy" @click="changeMode('list')">
            {{ t('moduleCatalog.cancel') }}
          </Button>
          <Button type="submit" :disabled="busy">
            <Loader2 v-if="busy" class="size-4 animate-spin" />
            {{ mode === 'edit' ? t('moduleCatalog.save') : t('moduleCatalog.upload') }}
          </Button>
        </div>
      </form>
      <div v-else class="grid max-h-[60vh] gap-4 overflow-auto sm:grid-cols-[1fr_1.5fr]">
        <div class="grid content-start gap-2">
          <Button v-if="canPublish" size="sm" variant="outline" :disabled="busy" @click="changeMode('create')">
            <Plus class="size-4" /> {{ t('moduleCatalog.create') }}
          </Button>
          <p v-if="!modules.length" class="px-2 py-4 text-sm text-muted-foreground">
            {{ busy ? t('moduleCatalog.loading') : t('moduleCatalog.empty') }}
          </p>
          <Button v-for="entry in modules" :key="entry.id" class="justify-start" :variant="entry.identity === selection?.identity ? 'secondary' : 'ghost'" :disabled="busy" @click="select(entry.identity)">
            <Archive class="size-4 shrink-0" />
            <span class="truncate">{{ entry.name }}</span>
          </Button>
        </div>
        <div v-if="selection" class="grid content-start gap-2">
          <h3 class="font-medium">
            {{ selection.name }}
          </h3>
          <code class="break-all text-sm text-muted-foreground">{{ selection.identity }}</code>
          <p v-if="selection.description" class="whitespace-pre-wrap break-words text-sm">
            {{ selection.description }}
          </p>
          <div v-if="canPublish" class="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" :disabled="busy" @click="changeMode('publish')">
              {{ t('moduleCatalog.addVersion') }}
            </Button>
            <Button size="sm" variant="ghost" :disabled="busy" @click="changeMode('edit')">
              {{ t('moduleCatalog.edit') }}
            </Button>
          </div>
          <div v-for="entry in selection.versions" :key="entry.version" class="flex items-center justify-between gap-2 rounded border px-3 py-2">
            <code class="break-all text-sm">{{ entry.version }}</code>
            <Button as-child size="sm" variant="ghost">
              <a :href="client?.archiveURL(entry.manifest)" download>
                <Download class="size-4" /> {{ t('moduleCatalog.download') }}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
