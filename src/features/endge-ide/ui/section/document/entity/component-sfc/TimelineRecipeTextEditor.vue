<script setup lang="ts">
import type { TimelineRecipeContent, TimelineRecipeStyle, TimelineRecipeTextStyle } from '@endge/core'
import { timelineRecipeTaskPath } from '@endge/core'
import { AlignCenter, AlignLeft, AlignRight, Bold, Ellipsis, Italic, Scissors } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { TooltipProvider } from '@/components/ui/tooltip'
import { colorInputValue } from './timeline-recipe-appearance'
import TimelineBindingInput from './TimelineBindingInput.vue'
import TimelineRecipeStyleEditor from './TimelineRecipeStyleEditor.vue'
import TimelineRecipeToolButton from './TimelineRecipeToolButton.vue'

const props = defineProps<{ content: TimelineRecipeContent, bindings: Readonly<Record<string, unknown>>, appearance?: TimelineRecipeStyle }>()
const emit = defineEmits<{ update: [patch: Partial<TimelineRecipeContent>], appearance: [style?: TimelineRecipeStyle] }>()
const { t } = useI18n()
const style = computed(() => props.content.textStyle ?? {})
const sources = ['sans-serif', 'serif', 'monospace', 'system-ui']
const expression = computed(() => props.content.expression ?? (props.content.field ? timelineRecipeTaskPath(props.content.field) : undefined))
const alignments = computed(() => [
  { value: 'left', icon: AlignLeft, label: t('timelineEditor.recipes.left') },
  { value: 'center', icon: AlignCenter, label: t('timelineEditor.recipes.center') },
  { value: 'right', icon: AlignRight, label: t('timelineEditor.recipes.right') },
] as const)
const styles = computed(() => [
  { key: 'bold', icon: Bold, label: t('timelineEditor.recipes.bold'), active: style.value.bold ?? false },
  { key: 'italic', icon: Italic, label: t('timelineEditor.recipes.italic'), active: style.value.italic ?? false },
  { key: 'ellipsis', icon: Ellipsis, label: t('timelineEditor.recipes.ellipsis'), active: style.value.ellipsis ?? true },
  { key: 'clip', icon: Scissors, label: t('timelineEditor.recipes.clip'), active: style.value.clip ?? true },
] as const)
const advanced = computed(() => [
  { key: 'lineHeight', label: t('timelineEditor.recipes.lineHeight'), min: 1 },
  { key: 'paddingX', label: t('timelineEditor.recipes.textPadding'), min: 0 },
  { key: 'minWidth', label: t('timelineEditor.recipes.textMinWidth'), min: 0 },
  { key: 'minHeight', label: t('timelineEditor.recipes.textMinHeight'), min: 0 },
] as const)

function changeText(value: string, binding: boolean) {
  if (binding) {
    emit('update', { expression: value.trim() || '""', field: undefined })
  }
  else {
    emit('update', { value })
  }
}

function toggleExpression() {
  emit('update', { field: undefined, expression: expression.value === undefined ? JSON.stringify(props.content.value) : undefined })
}

function patchStyle<K extends keyof TimelineRecipeTextStyle>(key: K, value: TimelineRecipeTextStyle[K]) {
  emit('update', { textStyle: { ...style.value, [key]: value } })
}

function read(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement).value
}

function changeNumber(key: 'size' | 'lineHeight' | 'paddingX' | 'minWidth' | 'minHeight', event: Event, min: number) {
  const raw = read(event)
  const value = Number(raw)
  if (!raw || Number.isFinite(value)) {
    patchStyle(key, raw ? Math.max(min, value) : undefined)
  }
}
</script>

<template>
  <div class="grid min-w-0 gap-2">
    <TimelineBindingInput
      :value="expression ?? content.value" :binding="expression !== undefined" :bindings="bindings"
      :label="$t('timelineEditor.recipes.text')" scope="timeline-recipe" expression-example="$task.title"
      @change="changeText" @toggle="toggleExpression"
    />
    <TooltipProvider :delay-duration="0">
      <div class="flex min-w-0 flex-wrap items-center gap-1.5">
        <div class="inline-flex items-center gap-0.5">
          <select class="h-8 w-28 rounded-md border bg-background px-1.5 text-xs" :aria-label="$t('timelineEditor.recipes.fontFamily')" :value="style.family ?? 'sans-serif'" @change="patchStyle('family', read($event))">
            <option v-if="style.family && !sources.includes(style.family)" :value="style.family">
              {{ style.family }}
            </option>
            <option v-for="family in sources" :key="family" :value="family">
              {{ family }}
            </option>
          </select>
          <TimelineRecipeStyleEditor field="fontFamily" :label="$t('timelineEditor.recipes.fontFamily')" :base="style.family ?? 'sans-serif'" :bindings="bindings" :appearance="appearance" @update="emit('appearance', $event)" />
        </div>
        <div class="inline-flex items-center gap-0.5">
          <Input type="number" min="1" class="h-8 w-16 px-1.5 text-xs" :aria-label="$t('timelineEditor.recipes.fontSize')" :model-value="style.size ?? 11" @change="changeNumber('size', $event, 1)" />
          <TimelineRecipeStyleEditor field="fontSize" :label="$t('timelineEditor.recipes.fontSize')" :base="style.size ?? 11" :bindings="bindings" :appearance="appearance" @update="emit('appearance', $event)" />
        </div>
        <div class="inline-flex items-center gap-0.5">
          <Input type="color" class="h-8 w-8 px-1 py-1" :aria-label="$t('timelineEditor.recipes.textColor')" :model-value="colorInputValue(style.color ?? '#ffffff', '#ffffff')" @change="patchStyle('color', read($event))" />
          <TimelineRecipeStyleEditor field="textColor" color :label="$t('timelineEditor.recipes.textColor')" :base="style.color ?? '#ffffff'" :bindings="bindings" :appearance="appearance" @update="emit('appearance', $event)" />
        </div>
        <div class="text-tools" role="group" :aria-label="$t('timelineEditor.recipes.textFormatting')">
          <TimelineRecipeToolButton v-for="item in styles.slice(0, 2)" :key="item.key" :label="item.label" :aria-pressed="item.active" @click="patchStyle(item.key, !item.active)">
            <component :is="item.icon" class="size-4" />
          </TimelineRecipeToolButton>
        </div>
        <div class="text-tools" role="group" :aria-label="$t('timelineEditor.recipes.align')">
          <TimelineRecipeToolButton v-for="item in alignments" :key="item.value" :label="item.label" :aria-pressed="content.align === item.value" @click="emit('update', { align: item.value })">
            <component :is="item.icon" class="size-4" />
          </TimelineRecipeToolButton>
        </div>
        <div class="text-tools" role="group" :aria-label="$t('timelineEditor.recipes.textOverflow')">
          <TimelineRecipeToolButton v-for="item in styles.slice(2)" :key="item.key" :label="item.label" :aria-pressed="item.active" @click="patchStyle(item.key, !item.active)">
            <component :is="item.icon" class="size-4" />
          </TimelineRecipeToolButton>
        </div>
        <TimelineRecipeStyleEditor :appearance="appearance" :bindings="bindings" @update="emit('appearance', $event)" />
      </div>
    </TooltipProvider>
    <details class="text-xs">
      <summary class="cursor-pointer text-muted-foreground">
        {{ $t('timelineEditor.recipes.moreTextOptions') }}
      </summary>
      <div class="mt-2 grid min-w-0 gap-2 sm:grid-cols-3">
        <label v-if="expression !== undefined" class="col-span-full grid min-w-0 gap-1">
          {{ $t('timelineEditor.recipes.fallbackText') }}
          <Input class="h-8" :model-value="content.value" @change="emit('update', { value: read($event) })" />
        </label>
        <label class="grid min-w-0 gap-1">
          {{ $t('timelineEditor.recipes.verticalAlign') }}
          <select class="h-8 min-w-0 rounded-md border bg-background px-2" :value="style.vertical ?? 'middle'" @change="patchStyle('vertical', read($event) as TimelineRecipeTextStyle['vertical'])">
            <option value="top">{{ $t('timelineEditor.recipes.alignTop') }}</option>
            <option value="middle">{{ $t('timelineEditor.recipes.alignMiddle') }}</option>
            <option value="bottom">{{ $t('timelineEditor.recipes.alignBottom') }}</option>
          </select>
        </label>
        <div v-for="item in advanced" :key="item.key" class="grid min-w-0 grid-cols-[1fr_auto] items-end gap-1">
          <label class="grid min-w-0 gap-1">
            {{ item.label }}
            <Input type="number" class="h-8" :min="item.min" :model-value="style[item.key] ?? (item.key === 'paddingX' ? 3 : item.key === 'minWidth' ? 12 : '')" @change="changeNumber(item.key, $event, item.min)" />
          </label>
          <TimelineRecipeStyleEditor v-if="item.key !== 'lineHeight'" :field="item.key" :label="item.label" :base="style[item.key] ?? (item.key === 'paddingX' ? 3 : item.key === 'minWidth' ? 12 : 0)" :bindings="bindings" :appearance="appearance" @update="emit('appearance', $event)" />
        </div>
      </div>
    </details>
  </div>
</template>

<style scoped>
.text-tools {
  display: flex;
  gap: 1px;
  padding: 2px;
  border-radius: .375rem;
  border: 1px solid var(--border);
}
.text-tools :deep(button) {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: .25rem;
}
.text-tools :deep(button:hover),
.text-tools :deep(button[aria-pressed='true']) {
  background: var(--accent);
}
</style>
