<script setup lang="ts">
import type { EndgeConfiguration, EndgeSFCRendererTag, ModuleRendererReference } from '@endge/core'
import { ENDGE_SFC_RENDERER_TAGS, isEndgeSFCRendererTag } from '@endge/core'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'

defineProps<{ disabled?: boolean }>()
const model = defineModel<EndgeConfiguration['defaultRenderers']>()
interface RendererOption {
  reference: ModuleRendererReference
  label: string
}
const options = ref<Partial<Record<EndgeSFCRendererTag, RendererOption[]>>>({})
const search = ref('')
const catalog = EndgeIDE.moduleCatalog
const error = ref('')
const { t } = useI18n()

function selectionKey(reference: ModuleRendererReference): string {
  return `${reference.identity}@${reference.version}:${reference.rendererId}`
}

const tags = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) {
    return ENDGE_SFC_RENDERER_TAGS
  }
  return ENDGE_SFC_RENDERER_TAGS.filter(tag => [
    tag,
    ...(options.value[tag] ?? []).flatMap(entry => [entry.label, selectionKey(entry.reference)]),
  ].some(value => value.toLocaleLowerCase().includes(query)))
})

function selection(tag: EndgeSFCRendererTag): string {
  const reference = model.value?.[tag]
  return reference ? selectionKey(reference) : 'adapter'
}

function isUnavailable(tag: EndgeSFCRendererTag): boolean {
  return Boolean(model.value?.[tag]) && !options.value[tag]?.some(entry => selectionKey(entry.reference) === selection(tag))
}

function select(tag: EndgeSFCRendererTag, value: unknown): void {
  const next = { ...model.value }
  if (value === 'adapter') {
    delete next[tag]
  }
  else {
    const chosen = options.value[tag]?.find(entry => selectionKey(entry.reference) === value)
    if (!chosen) {
      return
    }
    next[tag] = chosen.reference
  }
  model.value = Object.keys(next).length ? next : undefined
}

onMounted(() => void catalog.refresh())
watch(catalog.state, async (state, _previous, onCleanup) => {
  if (state.status === 'error') {
    error.value = state.message
    return
  }
  if (state.status !== 'ready') {
    return
  }
  error.value = ''
  const request = new AbortController()
  onCleanup(() => request.abort())
  try {
    const details = await Promise.all(state.entries.map(module => catalog.transport.detail(module.identity, request.signal)))
    if (request.signal.aborted) {
      return
    }
    const choices: typeof options.value = {}
    for (const module of details) {
      for (const version of module.versions) {
        for (const renderer of version.manifest.contributes?.renderers ?? []) {
          if (isEndgeSFCRendererTag(renderer.primitive)) {
            const tagOptions = choices[renderer.primitive] ??= []
            tagOptions.push({
              reference: { identity: module.identity, version: version.version, rendererId: renderer.id },
              label: `${renderer.label} · ${version.version}`,
            })
          }
        }
      }
    }
    options.value = choices
  }
  catch (cause) {
    if (!request.signal.aborted) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    }
  }
}, { immediate: true })
</script>

<template>
  <section class="space-y-3">
    <h3 class="text-sm font-medium">
      {{ t('moduleCatalog.tagRenderers') }}
    </h3>
    <Input v-model="search" type="search" :aria-label="t('moduleCatalog.searchRenderers')" :placeholder="t('moduleCatalog.searchRenderers')" />
    <p v-if="error" role="alert" class="text-sm text-destructive">
      {{ error }}
    </p>
    <div v-if="tags.length" class="divide-y rounded-md border">
      <div v-for="tag in tags" :key="tag" class="grid items-center gap-2 p-2 sm:grid-cols-[minmax(8rem,1fr)_2fr]">
        <div class="min-w-0">
          <code class="text-sm">{{ tag }}</code>
        </div>
        <Select :model-value="selection(tag)" :disabled="disabled" @update:model-value="select(tag, $event)">
          <SelectTrigger :aria-label="tag" class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="adapter">
              {{ t('moduleCatalog.adapterRenderer') }}
            </SelectItem>
            <SelectItem v-if="isUnavailable(tag)" :value="selection(tag)" disabled>
              {{ selection(tag) }}
            </SelectItem>
            <SelectItem v-for="entry in options[tag] ?? []" :key="selectionKey(entry.reference)" :value="selectionKey(entry.reference)">
              {{ entry.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
    <p v-else class="text-sm text-muted-foreground" role="status">
      {{ t('moduleCatalog.noRendererMatches') }}
    </p>
  </section>
</template>
