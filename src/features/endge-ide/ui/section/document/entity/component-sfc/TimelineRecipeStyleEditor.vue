<script setup lang="ts">
import type { TimelineRecipeColorCase, TimelineRecipeStyle, TimelineRecipeStyleField, TimelineRecipeStyleRule, TimelineRecipeTexture, TimelineRecipeTextureCase } from '@endge/core'
import { ArrowDown, ArrowUp, FunctionSquare, ListFilter, Plus, X } from 'lucide-vue-next'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { colorInputValue, timelineRecipeFillStyle } from './timeline-recipe-appearance'
import TimelineRecipeExpressionInput from './TimelineRecipeExpressionInput.vue'
import TimelineRecipeTextureInputs from './TimelineRecipeTextureInputs.vue'
import TimelineRecipeToolButton from './TimelineRecipeToolButton.vue'

const props = defineProps<{
  appearance?: TimelineRecipeStyle
  bindings: Readonly<Record<string, unknown>>
  field?: TimelineRecipeStyleField
  label?: string
  color?: boolean
  base?: string | number | boolean
  texture?: TimelineRecipeTexture
}>()
const emit = defineEmits<{ update: [style?: TimelineRecipeStyle] }>()
const { t } = useI18n()
const open = ref(false)
const formula = ref('')
const formulaMode = ref(false)
const cases = ref<TimelineRecipeColorCase[]>([])
const textureCases = ref<TimelineRecipeTextureCase[]>([])
const rules = ref<TimelineRecipeStyleRule[]>([])
const colorField = computed(() => props.color ? props.field as keyof NonNullable<TimelineRecipeStyle['colors']> : undefined)
const active = computed(() => props.field
  ? Boolean(props.appearance?.expressions?.[props.field] || (colorField.value && props.appearance?.colors?.[colorField.value]?.length))
  : Boolean(props.texture ? props.appearance?.textures?.length : props.appearance?.rules?.length))
const actionLabel = computed(() => props.field || props.texture
  ? t('timelineEditor.toggleExpression', { field: props.label })
  : t('timelineEditor.recipes.conditionalFormatting'))

const groupFields = computed(() => [
  { key: 'textColor', label: t('timelineEditor.recipes.textColor'), type: 'color', base: '#ffffff' },
  { key: 'fontSize', label: t('timelineEditor.recipes.fontSize'), type: 'number', base: 11, min: 1 },
  { key: 'fontFamily', label: t('timelineEditor.recipes.fontFamily'), type: 'text', base: 'sans-serif' },
  { key: 'bold', label: t('timelineEditor.recipes.bold'), type: 'boolean', base: true },
  { key: 'italic', label: t('timelineEditor.recipes.italic'), type: 'boolean', base: true },
  { key: 'ellipsis', label: t('timelineEditor.recipes.ellipsis'), type: 'boolean', base: true },
  { key: 'clip', label: t('timelineEditor.recipes.clip'), type: 'boolean', base: true },
  { key: 'align', label: t('timelineEditor.recipes.align'), type: 'select', base: 'center', options: { left: t('timelineEditor.recipes.left'), center: t('timelineEditor.recipes.center'), right: t('timelineEditor.recipes.right') } },
  { key: 'vertical', label: t('timelineEditor.recipes.verticalAlign'), type: 'select', base: 'middle', options: { top: t('timelineEditor.recipes.alignTop'), middle: t('timelineEditor.recipes.alignMiddle'), bottom: t('timelineEditor.recipes.alignBottom') } },
  { key: 'lineHeight', label: t('timelineEditor.recipes.lineHeight'), type: 'number', base: 14, min: 1 },
  { key: 'paddingX', label: t('timelineEditor.recipes.textPadding'), type: 'number', base: 3, min: 0 },
  { key: 'minWidth', label: t('timelineEditor.recipes.textMinWidth'), type: 'number', base: 12, min: 0 },
  { key: 'minHeight', label: t('timelineEditor.recipes.textMinHeight'), type: 'number', base: 0, min: 0 },
] as const)
type GroupField = typeof groupFields.value[number]
const groupKeys = new Set<TimelineRecipeStyleField>(groupFields.value.map(field => field.key))
const hasGroupField = (rule: TimelineRecipeStyleRule) => Object.keys(rule.values).some(key => groupKeys.has(key as TimelineRecipeStyleField))

watch(open, (value) => {
  if (!value) {
    return
  }
  const source = props.field && props.appearance?.expressions?.[props.field]
  formula.value = source || JSON.stringify(props.base ?? '')
  formulaMode.value = !colorField.value || Boolean(source)
  cases.value = colorField.value ? (props.appearance?.colors?.[colorField.value] ?? []).map(entry => ({ ...entry })) : []
  textureCases.value = props.texture ? (props.appearance?.textures ?? []).map(entry => ({ when: entry.when, fill: { ...entry.fill } })) : []
  rules.value = (props.appearance?.rules ?? []).filter(hasGroupField).map(rule => ({ when: rule.when, values: { ...rule.values } }))
})

function move<T>(list: T[], index: number, delta: number) {
  const next = index + delta
  if (next >= 0 && next < list.length) {
    const [entry] = list.splice(index, 1)
    list.splice(next, 0, entry!)
  }
}

function setValue(rule: TimelineRecipeStyleRule, field: GroupField, input: string | number) {
  const value = field.type === 'number' ? Number(input) : field.type === 'boolean' ? input === 'true' : input
  rule.values = { ...rule.values, [field.key]: value }
}

function toggleValue(rule: TimelineRecipeStyleRule, field: GroupField, event: Event) {
  if ((event.target as HTMLInputElement).checked) {
    rule.values = { ...rule.values, [field.key]: field.base }
  }
  else {
    delete rule.values[field.key]
  }
}

const valid = computed(() => {
  if (props.field) {
    return formulaMode.value
      ? Boolean(formula.value.trim())
      : cases.value.every(entry => entry.when.trim())
  }
  if (props.texture) {
    return textureCases.value.every(entry => entry.when.trim())
  }
  return rules.value.every(rule => rule.when.trim() && Object.keys(rule.values).length && groupFields.value.every((field) => {
    const value = rule.values[field.key]
    return value === undefined || (
      (field.type !== 'number' || (typeof value === 'number' && value >= field.min))
      && (field.type !== 'text' || (typeof value === 'string' && value.trim()))
    )
  }))
})

function save(clear = false) {
  const expressions = { ...props.appearance?.expressions }
  const colors = { ...props.appearance?.colors }
  let nextRules = props.appearance?.rules
  let textures = props.appearance?.textures
  if (props.field) {
    const source = !clear && formulaMode.value ? formula.value.trim() : ''
    if (source) {
      expressions[props.field] = source
    }
    else {
      delete expressions[props.field]
    }
    if (colorField.value) {
      if (!clear && !formulaMode.value && cases.value.length) {
        colors[colorField.value] = cases.value.map(entry => ({ when: entry.when.trim(), color: entry.color }))
      }
      else {
        delete colors[colorField.value]
      }
    }
  }
  else if (props.texture) {
    textures = clear ? undefined : textureCases.value.map(entry => ({ when: entry.when.trim(), fill: { ...entry.fill } }))
  }
  else {
    const edited = clear ? [] : rules.value.map(rule => ({ when: rule.when.trim(), values: { ...rule.values } }))
    const previous = nextRules ?? []
    let index = 0
    nextRules = previous.flatMap(rule => hasGroupField(rule) ? [edited[index++]].filter(Boolean) : [rule]).concat(edited.slice(index))
  }
  const style: TimelineRecipeStyle = {
    expressions: Object.keys(expressions).length ? expressions : undefined,
    colors: Object.keys(colors).length ? colors : undefined,
    textures: textures?.length ? textures : undefined,
    rules: nextRules?.length ? nextRules : undefined,
  }
  emit('update', style.expressions || style.colors || style.textures || style.rules ? style : undefined)
  open.value = false
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <TimelineRecipeToolButton
        :label="actionLabel" :aria-pressed="active"
        class="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded border bg-background px-1 text-xs text-muted-foreground hover:bg-accent aria-pressed:border-primary/40 aria-pressed:text-primary"
      >
        <FunctionSquare v-if="field || texture" class="size-4" aria-hidden="true" />
        <ListFilter v-else class="size-4" aria-hidden="true" />
      </TimelineRecipeToolButton>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :aria-label="actionLabel" align="end" :side-offset="6"
        class="z-[10002] grid w-[26rem] max-w-[calc(100vw-2rem)] gap-3 rounded-md border bg-popover p-3.5 text-popover-foreground shadow-lg"
      >
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">
            {{ label || $t('timelineEditor.recipes.conditionalFormatting') }}
          </h3>
          <Button v-if="colorField" size="sm" variant="ghost" class="h-7 text-xs" :aria-pressed="formulaMode" @click="formulaMode = !formulaMode">
            {{ $t('timelineEditor.recipes.formula') }}
          </Button>
        </div>
        <div class="grid max-h-[min(55vh,32rem)] gap-2 overflow-y-auto px-0.5">
          <template v-if="field">
            <TimelineRecipeExpressionInput
              v-if="formulaMode" v-model="formula" :bindings="bindings" :label="label ?? actionLabel"
              :placeholder="colorField ? '$task.endTime - $task.startTime > 600000 ? \'#dc2626\' : \'#2563eb\'' : undefined"
            />
            <p v-if="field === 'iconName'" class="text-xs text-muted-foreground">
              {{ $t('timelineEditor.recipes.iconExpressionHint') }}
            </p>
            <div v-if="field === 'opacity' && formulaMode" class="text-xs text-muted-foreground">
              {{ $t('timelineEditor.recipes.opacityExpressionHint') }}
            </div>
            <template v-if="colorField && !formulaMode">
              <div v-for="(entry, index) in cases" :key="index" class="grid gap-2 rounded-md border p-2">
                <div class="flex items-center justify-between gap-1.5">
                  <span class="text-xs font-medium">{{ $t('timelineEditor.recipes.styleIf') }}</span>
                  <div class="flex gap-1">
                    <TimelineRecipeToolButton :label="$t('timelineEditor.recipes.ruleUp')" :disabled="index === 0" class="disabled:opacity-30" @click="move(cases, index, -1)">
                      <ArrowUp class="size-3.5" />
                    </TimelineRecipeToolButton>
                    <TimelineRecipeToolButton :label="$t('timelineEditor.recipes.ruleDown')" :disabled="index === cases.length - 1" class="disabled:opacity-30" @click="move(cases, index, 1)">
                      <ArrowDown class="size-3.5" />
                    </TimelineRecipeToolButton>
                    <TimelineRecipeToolButton :label="$t('timelineEditor.recipes.removeStyleRule')" @click="cases.splice(index, 1)">
                      <X class="size-4" />
                    </TimelineRecipeToolButton>
                  </div>
                </div>
                <TimelineRecipeExpressionInput v-model="entry.when" :bindings="bindings" :label="$t('timelineEditor.recipes.condition')" placeholder="$task.endTime - $task.startTime > 600000" />
                <label class="flex items-center justify-between gap-2 text-xs">
                  {{ $t('timelineEditor.recipes.styleThenColor') }}
                  <Input :model-value="colorInputValue(entry.color)" type="color" class="h-7 w-12 p-0.5" @update:model-value="entry.color = String($event)" />
                </label>
              </div>
              <Button size="sm" variant="outline" class="justify-self-start" :disabled="cases.length >= 32" @click="cases.push({ when: '', color: colorInputValue(String(base ?? '#478acf')) })">
                <Plus class="size-3.5" /> {{ $t('timelineEditor.recipes.addStyleRule') }}
              </Button>
            </template>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              {{ $t('timelineEditor.recipes.fallbackStyle') }}
              <span v-if="colorField" class="size-4 rounded border" :style="{ background: String(base) }" />
              <span v-else>{{ base }}</span>
            </div>
          </template>
          <template v-else-if="texture">
            <div v-for="(entry, index) in textureCases" :key="index" class="grid gap-2 rounded-md border p-2.5">
              <div class="flex items-center justify-between gap-1.5">
                <span class="text-xs font-medium">{{ $t('timelineEditor.recipes.styleIf') }}</span>
                <div class="flex gap-1">
                  <TimelineRecipeToolButton :label="$t('timelineEditor.recipes.ruleUp')" :disabled="index === 0" class="disabled:opacity-30" @click="move(textureCases, index, -1)">
                    <ArrowUp class="size-3.5" />
                  </TimelineRecipeToolButton>
                  <TimelineRecipeToolButton :label="$t('timelineEditor.recipes.ruleDown')" :disabled="index === textureCases.length - 1" class="disabled:opacity-30" @click="move(textureCases, index, 1)">
                    <ArrowDown class="size-3.5" />
                  </TimelineRecipeToolButton>
                  <TimelineRecipeToolButton :label="$t('timelineEditor.recipes.removeStyleRule')" @click="textureCases.splice(index, 1)">
                    <X class="size-4" />
                  </TimelineRecipeToolButton>
                </div>
              </div>
              <TimelineRecipeExpressionInput v-model="entry.when" :bindings="bindings" :label="$t('timelineEditor.recipes.condition')" placeholder="$task.takeoffDurationMinutes > 4" />
              <TimelineRecipeTextureInputs :fill="entry.fill" @update="entry.fill = $event" />
            </div>
            <Button size="sm" variant="outline" class="justify-self-start" :disabled="textureCases.length >= 32" @click="textureCases.push({ when: '', fill: { ...texture } })">
              <Plus class="size-3.5" /> {{ $t('timelineEditor.recipes.addStyleRule') }}
            </Button>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              {{ $t('timelineEditor.recipes.fallbackStyle') }}
              <span class="size-4 rounded border" :style="timelineRecipeFillStyle(texture)" />
            </div>
          </template>
          <template v-else>
            <div v-for="(rule, index) in rules" :key="index" class="grid gap-2 rounded-md border p-2.5">
              <div class="flex items-center justify-between gap-1.5">
                <span class="text-xs font-medium">{{ $t('timelineEditor.recipes.styleIf') }}</span>
                <div class="flex gap-1">
                  <TimelineRecipeToolButton :label="$t('timelineEditor.recipes.ruleUp')" :disabled="index === 0" class="disabled:opacity-30" @click="move(rules, index, -1)">
                    <ArrowUp class="size-3.5" />
                  </TimelineRecipeToolButton>
                  <TimelineRecipeToolButton :label="$t('timelineEditor.recipes.ruleDown')" :disabled="index === rules.length - 1" class="disabled:opacity-30" @click="move(rules, index, 1)">
                    <ArrowDown class="size-3.5" />
                  </TimelineRecipeToolButton>
                  <TimelineRecipeToolButton :label="$t('timelineEditor.recipes.removeStyleRule')" @click="rules.splice(index, 1)">
                    <X class="size-4" />
                  </TimelineRecipeToolButton>
                </div>
              </div>
              <TimelineRecipeExpressionInput v-model="rule.when" :bindings="bindings" :label="$t('timelineEditor.recipes.condition')" placeholder="$task.delayMs > 0" />
              <div class="grid gap-1 sm:grid-cols-2">
                <div v-for="item in groupFields" :key="item.key" class="grid min-w-0 gap-1">
                  <label class="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" :checked="rule.values[item.key] !== undefined" @change="toggleValue(rule, item, $event)">
                    {{ item.label }}
                  </label>
                  <template v-if="rule.values[item.key] !== undefined">
                    <select v-if="item.type === 'select'" class="h-7 rounded border bg-background px-1 text-xs" :aria-label="item.label" :value="rule.values[item.key]" @change="setValue(rule, item, ($event.target as HTMLSelectElement).value)">
                      <option v-for="(text, value) in item.options" :key="value" :value="value">
                        {{ text }}
                      </option>
                    </select>
                    <select v-else-if="item.type === 'boolean'" class="h-7 rounded border bg-background px-1 text-xs" :aria-label="item.label" :value="String(rule.values[item.key])" @change="setValue(rule, item, ($event.target as HTMLSelectElement).value)">
                      <option value="true">
                        {{ $t('timelineEditor.recipes.styleEnabled') }}
                      </option>
                      <option value="false">
                        {{ $t('timelineEditor.recipes.styleDisabled') }}
                      </option>
                    </select>
                    <Input v-else :type="item.type" :min="item.type === 'number' ? item.min : undefined" :aria-label="item.label" :model-value="item.type === 'color' ? colorInputValue(String(rule.values[item.key])) : String(rule.values[item.key])" class="h-7 text-xs" @update:model-value="setValue(rule, item, $event)" />
                  </template>
                </div>
              </div>
            </div>
            <Button size="sm" variant="outline" class="justify-self-start" :disabled="rules.length >= 32" @click="rules.push({ when: '', values: {} })">
              <Plus class="size-3.5" /> {{ $t('timelineEditor.recipes.addStyleRule') }}
            </Button>
          </template>
        </div>
        <div class="flex items-center justify-end gap-2 border-t pt-2">
          <Button v-if="active" size="sm" variant="ghost" class="mr-auto" @click="save(true)">
            {{ $t('timelineEditor.recipes.resetStyleRule') }}
          </Button>
          <Button size="sm" :disabled="!valid" @click="save()">
            {{ $t('timelineEditor.recipes.applyStyleRule') }}
          </Button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
