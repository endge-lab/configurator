<script setup lang="ts">
import { Endge, resolveComponentSFCExpressionCompletions } from '@endge/core'
import { Braces, Search } from 'lucide-vue-next'
import { ComboboxContent, ComboboxInput, ComboboxItem, ComboboxRoot, ComboboxViewport, ComboboxVirtualizer, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import ComponentSFCExpressionInput from './ComponentSFCExpressionInput.vue'

const props = defineProps<{ modelValue: string, bindings: Readonly<Record<string, unknown>> }>()
const emit = defineEmits<{ 'update:modelValue': [value: string], 'commit': [] }>()
const editor = ref<InstanceType<typeof ComponentSFCExpressionInput>>()
const open = ref(false)
const query = ref('')
let position: ReturnType<NonNullable<typeof editor.value>['selectionRange']> | undefined
let inserting = false

const catalog = computed(() => {
  if (!open.value) {
    return []
  }
  const context = Endge.context.runtimeSnapshot()
  const configurations = Endge.configurationSchema.list()
  const roots = { ...props.bindings, $context: context }
  const entries: { path: string, detail: string }[] = []
  const parents = new Set<object>()
  const descend = (path: string, value: unknown) => {
    const object = value && typeof value === 'object' ? value : null
    if (object && parents.has(object)) {
      return
    }
    if (object) {
      parents.add(object)
    }
    const source = path ? `${path}.` : ''
    for (const suggestion of resolveComponentSFCExpressionCompletions({
      source,
      cursor: source.length,
      scope: 'timeline-recipe',
      bindings: props.bindings,
      context,
      configurations,
    })) {
      const reference = `${source}${suggestion.label}`
      entries.push({ path: reference, detail: suggestion.documentation ?? suggestion.detail })
      const child = value != null ? Object(value)[suggestion.label] : undefined
      if (child !== undefined || !path) {
        descend(reference, child)
      }
    }
    if (object) {
      parents.delete(object)
    }
  }
  descend('', roots)
  return entries
})

const filtered = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  return catalog.value.filter(item => !search || `${item.path} ${item.detail}`.toLocaleLowerCase().includes(search))
})

watch(open, (value) => {
  if (!value) {
    query.value = ''
  }
})

function restoreFocus(event: Event) {
  if (inserting) {
    event.preventDefault()
    inserting = false
  }
}

function choose(reference: unknown) {
  if (typeof reference !== 'string' || !reference) {
    return
  }
  inserting = true
  open.value = false
  editor.value?.insertReference(reference, position)
}
</script>

<template>
  <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-1.5">
    <div class="min-w-0 flex-1">
      <ComponentSFCExpressionInput
        ref="editor"
        :model-value="modelValue"
        scope="timeline-recipe"
        :bindings="bindings"
        :aria-label="$t('timelineEditor.recipes.condition')"
        input-class="h-9 w-full font-mono text-xs md:text-xs"
        placeholder="$task.delayMs > 0"
        @update:model-value="emit('update:modelValue', $event)"
        @commit="emit('commit')"
      />
    </div>
    <PopoverRoot v-model:open="open">
      <PopoverTrigger as-child>
        <Button
          type="button"
          size="icon"
          variant="outline"
          class="size-9 text-muted-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground"
          :aria-label="$t('timelineEditor.recipes.referencePicker')"
          :title="$t('timelineEditor.recipes.referencePicker')"
          @click="position = editor?.selectionRange()"
        >
          <Braces class="size-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent
          :aria-label="$t('timelineEditor.recipes.referencePicker')"
          align="end"
          :side-offset="6"
          :collision-padding="12"
          class="z-[9999] w-96 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg outline-none"
          @close-auto-focus="restoreFocus"
        >
          <ComboboxRoot v-model:open="open" ignore-filter @update:model-value="choose">
            <div class="flex items-center gap-2 border-b px-3">
              <Search class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <ComboboxInput
                v-model="query"
                class="h-10 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                :aria-label="$t('timelineEditor.recipes.referenceSearch')"
                :placeholder="$t('timelineEditor.recipes.referenceSearch')"
              />
            </div>
            <ComboboxContent>
              <ComboboxViewport v-if="filtered.length" class="max-h-[min(16rem,45vh)] w-full min-w-0 overscroll-contain p-1.5">
                <ComboboxVirtualizer v-slot="{ option }" :options="filtered" :estimate-size="48" :text-content="item => item.path">
                  <ComboboxItem :value="option.path" class="flex h-12 w-full min-w-0 cursor-pointer flex-col items-start justify-center gap-0.5 rounded-md px-2.5 text-left outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground">
                    <code class="block w-full truncate font-mono text-xs font-medium leading-4" :title="option.path">{{ option.path }}</code>
                    <span class="block w-full truncate text-xs leading-4 text-muted-foreground" :title="option.detail">{{ option.detail }}</span>
                  </ComboboxItem>
                </ComboboxVirtualizer>
              </ComboboxViewport>
              <p v-else class="px-3 py-4 text-center text-xs text-muted-foreground">
                {{ $t('uiText.nothingFound1e1b70b1') }}
              </p>
            </ComboboxContent>
          </ComboboxRoot>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </div>
</template>
