<script setup lang="ts">
import type { EndgeConfiguration, EndgeConfigurationPatch, EndgeSFCRendererTag, ModuleRendererReference, ModuleTimelinePresetReference } from '@endge/core'
import { ENDGE_SFC_RENDERER_TAGS, isEndgeSFCRendererTag } from '@endge/core'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'

const props = defineProps<{ disabled?: boolean, facet?: boolean }>()
const model = defineModel<EndgeConfiguration['defaultRenderers']>()
const overrides = defineModel<EndgeConfigurationPatch['defaultRenderers']>('overrides')
const timelinePresets = defineModel<EndgeConfiguration['timelinePresets']>('timelinePresets')
interface RendererOption {
  reference: ModuleRendererReference
  label: string
}
interface TimelinePresetOption {
  reference: ModuleTimelinePresetReference
  label?: string
}
const options = ref<Partial<Record<EndgeSFCRendererTag, RendererOption[]>>>({})
const catalogPresets = ref<TimelinePresetOption[]>([])
const search = ref('')
const catalog = EndgeIDE.moduleCatalog
const error = ref('')
const { t } = useI18n()

function selectionKey(reference: ModuleRendererReference): string {
  return `${reference.identity}@${reference.version}:${reference.rendererId}`
}

function presetKey({ name, identity, version }: ModuleTimelinePresetReference): string {
  return `${identity}@${version}:${name}`
}

const presetOptions = computed(() => {
  const entries = new Map(catalogPresets.value.map(option => [presetKey(option.reference), option]))
  for (const reference of timelinePresets.value ?? []) {
    const key = presetKey(reference)
    if (!entries.has(key)) {
      entries.set(key, { reference })
    }
  }
  return [...entries.values()]
})
const selectedPresetKeys = computed(() => new Set(timelinePresets.value?.map(presetKey)))

function selectPreset(reference: ModuleTimelinePresetReference, selected: boolean): void {
  const previous = timelinePresets.value ?? []
  if (!selected && !selectedPresetKeys.value.has(presetKey(reference))) {
    return
  }
  const next = previous.filter(item => item.name !== reference.name)
  if (selected) {
    next.push(reference)
  }
  timelinePresets.value = next.length ? next : undefined
}

const tags = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) {
    return ENDGE_SFC_RENDERER_TAGS
  }
  return ENDGE_SFC_RENDERER_TAGS.filter(tag => {
    const terms = [tag, ...(options.value[tag] ?? []).flatMap(entry => [entry.label, selectionKey(entry.reference)])]
    if (tag === 'TimelineChart' && !props.facet) {
      terms.push(t('moduleCatalog.timelineChartPresets'), ...presetOptions.value.flatMap(entry => [entry.label ?? '', presetKey(entry.reference)]))
    }
    return terms.some(value => value.toLocaleLowerCase().includes(query))
  })
})

function selection(tag: EndgeSFCRendererTag): string {
  if (props.facet) {
    const override = overrides.value?.[tag]
    if (!override) {
      return 'inherit'
    }
    return override.op === 'remove' ? 'adapter' : selectionKey(override.value)
  }
  const reference = model.value?.[tag]
  return reference ? selectionKey(reference) : 'adapter'
}

function findOption(tag: EndgeSFCRendererTag, value: unknown): RendererOption | undefined {
  return options.value[tag]?.find(entry => selectionKey(entry.reference) === value)
}

function selectionLabel(tag: EndgeSFCRendererTag): string {
  const value = selection(tag)
  if (value === 'inherit') {
    return t('moduleCatalog.inheritRenderer')
  }
  if (value === 'adapter') {
    return t('moduleCatalog.adapterRenderer')
  }
  return findOption(tag, value)?.label ?? value
}

function isUnavailable(tag: EndgeSFCRendererTag): boolean {
  const value = selection(tag)
  return value !== 'adapter' && value !== 'inherit' && !findOption(tag, value)
}

function select(tag: EndgeSFCRendererTag, value: unknown): void {
  const chosen = findOption(tag, value)
  if (props.facet) {
    const next = { ...overrides.value }
    if (value === 'inherit') {
      delete next[tag]
    }
    else if (value === 'adapter') {
      next[tag] = { op: 'remove' }
    }
    else if (chosen) {
      next[tag] = { op: 'set', value: chosen.reference }
    }
    overrides.value = Object.keys(next).length ? next : undefined
    return
  }
  const next = { ...model.value }
  if (value === 'adapter') {
    delete next[tag]
  }
  else {
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
    const presets: TimelinePresetOption[] = []
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
        for (const preset of version.manifest.contributes?.timelinePresets ?? []) {
          presets.push({
            reference: { identity: module.identity, version: version.version, name: preset.name },
            label: preset.label,
          })
        }
      }
    }
    options.value = choices
    catalogPresets.value = presets
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
            <SelectValue>{{ selectionLabel(tag) }}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-if="facet" value="inherit">
              {{ t('moduleCatalog.inheritRenderer') }}
            </SelectItem>
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
        <details v-if="tag === 'TimelineChart' && !facet" class="rounded-md bg-muted/40 px-3 py-2 sm:col-span-2">
          <summary class="cursor-pointer text-sm font-medium">
            {{ t('moduleCatalog.timelineChartPresets') }}
          </summary>
          <ul v-if="presetOptions.length" class="mt-2 space-y-1">
            <li v-for="option in presetOptions" :key="presetKey(option.reference)">
              <label class="flex items-start gap-2 rounded-sm p-1 text-sm">
                <Checkbox
                  class="mt-0.5"
                  :disabled="disabled"
                  :model-value="selectedPresetKeys.has(presetKey(option.reference))"
                  @update:model-value="selectPreset(option.reference, $event === true)"
                />
                <span class="min-w-0">
                  <span v-if="option.label" class="break-words">{{ option.label }} · </span>
                  <code class="break-all">{{ option.reference.name }}</code>
                  <span class="block break-all text-xs text-muted-foreground">{{ option.reference.identity }}@{{ option.reference.version }}</span>
                </span>
              </label>
            </li>
          </ul>
          <p v-else class="mt-2 text-sm text-muted-foreground">
            {{ t('moduleCatalog.noCatalogTimelinePresets') }}
          </p>
        </details>
      </div>
    </div>
    <p v-else class="text-sm text-muted-foreground" role="status">
      {{ t('moduleCatalog.noRendererMatches') }}
    </p>
  </section>
</template>
