<script setup lang="ts">
import type {
  ComponentSFCInteractionTriggerProjection,
  ComponentSFCTableCellInteractionRuleProjection,
  ComponentSFCTableCellInteractionsProjection,
} from '@endge/core'

import { getComponentSFCIntrinsicEventDefinitions } from '@endge/core'
import { FileCode2, Plus, Trash2 } from 'lucide-vue-next'
import { nextTick, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'

import ComponentSFCInteractionBindingEditor from './ComponentSFCInteractionBindingEditor.vue'
import ComponentSFCReactionEditor from './ComponentSFCReactionEditor.vue'

const props = defineProps<{
  modelValue: ComponentSFCTableCellInteractionsProjection
}>()

const emit = defineEmits<{
  (event: 'update', value: string | null, complete?: (saved: boolean) => void): void
  (event: 'openSource'): void
}>()

const events = getComponentSFCIntrinsicEventDefinitions('Cell')
const LEGACY_REACTION_PLACEHOLDER = `action({ identity: 'action.identity', input: { rowId: rowKey, row, rowIndex, columnKey, value, event: event() } })`
const drafts = ref<ComponentSFCTableCellInteractionRuleProjection[]>([])
const reactionEditorRefs = ref<Array<{ flushPendingEdits: () => boolean }>>([])

watch(
  () => props.modelValue,
  value => drafts.value = value.rules.map(cloneRule),
  { immediate: true, deep: true },
)

function cloneTrigger(value: ComponentSFCInteractionTriggerProjection): ComponentSFCInteractionTriggerProjection {
  return {
    ...value,
    key: [...value.key],
    code: [...value.code],
    held: value.held ? { ...value.held, key: [...value.held.key], code: [...value.held.code] } : null,
    modifiers: { ...value.modifiers },
    flags: { ...value.flags },
  }
}

function cloneRule(rule: ComponentSFCTableCellInteractionRuleProjection): ComponentSFCTableCellInteractionRuleProjection {
  return {
    ...cloneTrigger(rule),
    reactionSource: rule.reactionSource.trim() === LEGACY_REACTION_PLACEHOLDER ? '' : rule.reactionSource,
  }
}

function createRule(): ComponentSFCTableCellInteractionRuleProjection {
  return {
    event: 'click',
    key: [],
    code: [],
    held: null,
    modifiers: {},
    repeat: null,
    composing: null,
    button: 0,
    flags: {},
    reactionSource: '',
  }
}

function addRule(): void {
  drafts.value = [...drafts.value, createRule()]
}

function removeRule(index: number): void {
  const next = [...drafts.value]
  next.splice(index, 1)
  drafts.value = next
  commit()
}

function updateTrigger(index: number, trigger: ComponentSFCInteractionTriggerProjection): void {
  const rule = drafts.value[index]
  if (!rule) {
    return
  }
  drafts.value[index] = { ...cloneTrigger(trigger), reactionSource: rule.reactionSource }
  if (rule.reactionSource.trim()) {
    commit()
  }
}

function updateReaction(index: number, value: string | null, complete?: (saved: boolean) => void): void {
  const rule = drafts.value[index]
  const reactionSource = value?.trim() ?? ''
  if (!rule || !reactionSource) {
    complete?.(false)
    return
  }
  rule.reactionSource = reactionSource
  commit(complete)
}

function commit(complete?: (saved: boolean) => void): void {
  const completeRules = drafts.value.filter(rule => Boolean(rule.reactionSource.trim()))
  emit('update', completeRules.length ? serializeRules(completeRules) : null, complete)
}

/** Последовательно применяет открытые reaction-черновики, не теряя Source между patches. */
async function flushPendingEdits(): Promise<boolean> {
  for (const editor of [...reactionEditorRefs.value]) {
    if (!editor.flushPendingEdits()) {
      return false
    }
    await nextTick()
  }
  return true
}

defineExpose({ flushPendingEdits })

function serializeRules(rules: ComponentSFCTableCellInteractionRuleProjection[]): string {
  const serialized = rules.map(serializeRule)
  return serialized.length === 1 ? serialized[0]! : `[\n${serialized.map(rule => `  ${rule}`).join(',\n')}\n]`
}

function serializeRule(rule: ComponentSFCTableCellInteractionRuleProjection): string {
  const fields = [`event: ${quote(rule.event)}`]
  if (rule.key.length) {
    fields.push(`key: ${serializeStringList(rule.key)}`)
  }
  if (rule.code.length) {
    fields.push(`code: ${serializeStringList(rule.code)}`)
  }
  if (rule.held) {
    const held = []
    if (rule.held.key.length) {
      held.push(`key: ${serializeStringList(rule.held.key)}`)
    }
    if (rule.held.code.length) {
      held.push(`code: ${serializeStringList(rule.held.code)}`)
    }
    if (rule.held.match === 'any') {
      held.push(`match: 'any'`)
    }
    if (rule.held.exact) {
      held.push('exact: true')
    }
    if (held.length) {
      fields.push(`held: { ${held.join(', ')} }`)
    }
  }
  const modifiers = Object.entries(rule.modifiers)
    .filter(([, value]) => value != null)
    .map(([name, value]) => `${name}: ${value}`)
  if (modifiers.length) {
    fields.push(`modifiers: { ${modifiers.join(', ')} }`)
  }
  if (rule.repeat != null) {
    fields.push(`repeat: ${rule.repeat}`)
  }
  if (rule.composing != null) {
    fields.push(`composing: ${rule.composing}`)
  }
  if (rule.button != null) {
    fields.push(`button: ${rule.button}`)
  }
  for (const flag of ['stop', 'prevent', 'self', 'once', 'capture', 'passive'] as const) {
    if (rule.flags[flag] === true) {
      fields.push(`${flag}: true`)
    }
  }
  fields.push(`reaction: ${rule.reactionSource.trim()}`)
  return `{ ${fields.join(', ')} }`
}

function serializeStringList(values: string[]): string {
  return values.length === 1 ? quote(values[0]!) : `[${values.map(quote).join(', ')}]`
}

function quote(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, String.raw`\'`)
  return `'${escaped}'`
}
</script>

<template>
  <section class="bg-background/10 px-5 py-4">
    <div class="mb-3 flex justify-end">
      <Button v-if="modelValue.editable" type="button" size="sm" class="gap-1.5" @click="addRule">
        <Plus class="size-3.5" />
        {{ $t('uiText.eventBb92633b') }}
      </Button>
    </div>

    <div v-if="!modelValue.editable" class="editor-control flex items-center justify-between gap-4 rounded-lg border border-border/70 px-4 py-3">
      <div class="min-w-0">
        <div class="text-sm font-medium">
          {{ $t('uiText.annotationControlledBySource8ef6ddf0') }}
        </div>
        <div class="mt-0.5 text-xs text-muted-foreground">
          {{ modelValue.message }}
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" class="shrink-0 gap-1.5" @click="$emit('openSource')">
        <FileCode2 class="size-3.5" />
        {{ $t('uiText.open1259571a') }}
      </Button>
    </div>

    <div v-else-if="!drafts.length" class="rounded-lg border border-dashed border-border/70 px-4 py-7 text-center text-xs text-muted-foreground">
      {{ $t('uiText.noHandlersAddOnlyEventsThatRequireAReactionaf3dff1c') }}
    </div>

    <div v-else class="space-y-2">
      <div v-if="modelValue.suffixes.length" class="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        <span>{{ $t('uiText.forAllRulesfea7ba6c') }}</span>
        <code v-for="suffix in modelValue.suffixes" :key="suffix" class="rounded bg-muted px-1.5 py-0.5">{{ $t('uiText.symbol3a52ce78') }}{{ suffix }}</code>
      </div>

      <ComponentSFCInteractionBindingEditor
        v-for="(rule, index) in drafts"
        :key="`${index}:${rule.event}`"
        :trigger="rule"
        :events="events"
        @update:trigger="updateTrigger(index, $event)"
      >
        <template #actions>
          <Button type="button" variant="ghost" size="icon" class="size-8 text-muted-foreground hover:text-destructive" aria-label="Удалить обработчик" @click="removeRule(index)">
            <Trash2 class="size-3.5" />
          </Button>
        </template>
        <template #reaction>
          <ComponentSFCReactionEditor
            ref="reactionEditorRefs"
            :model-value="rule.reactionSource"
            :event-name="rule.event"
            @save="(value, complete) => updateReaction(index, value, complete)"
          />
        </template>
      </ComponentSFCInteractionBindingEditor>
    </div>
  </section>
</template>
