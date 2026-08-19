<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type {
  ComponentSFCInteractionTriggerProjection,
  ComponentSFCTableCellInteractionModifier,
  ComponentSFCTableCellInteractionRuleProjection,
  ComponentSFCTableCellInteractionsProjection,
} from '@endge/core'

import { getComponentSFCIntrinsicEventDefinitions } from '@endge/core'
import { ChevronDown, FileCode2, Plus, Trash2 } from 'lucide-vue-next'
import { ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'

import ComponentSFCInteractionTriggerEditor from './ComponentSFCInteractionTriggerEditor.vue'
import ComponentSFCReactionEditor from './ComponentSFCReactionEditor.vue'

const props = defineProps<{
  modelValue: ComponentSFCTableCellInteractionsProjection
}>()

const emit = defineEmits<{
  (event: 'update', value: string | null): void
  (event: 'openSource'): void
}>()

const events = getComponentSFCIntrinsicEventDefinitions('Cell')
const drafts = ref<ComponentSFCTableCellInteractionRuleProjection[]>([])
const expanded = ref<Set<number>>(new Set())

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
  return { ...cloneTrigger(rule), reactionSource: rule.reactionSource }
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
    reactionSource: defaultReactionSource(),
  }
}

function addRule(): void {
  const next = [...drafts.value, createRule()]
  drafts.value = next
  expanded.value = new Set([...expanded.value, next.length - 1])
  commit()
}

function removeRule(index: number): void {
  const next = [...drafts.value]
  next.splice(index, 1)
  drafts.value = next
  expanded.value = new Set([...expanded.value].filter(item => item !== index).map(item => item > index ? item - 1 : item))
  commit()
}

function setExpanded(index: number, open: boolean): void {
  const next = new Set(expanded.value)
  open ? next.add(index) : next.delete(index)
  expanded.value = next
}

function updateTrigger(index: number, trigger: ComponentSFCInteractionTriggerProjection): void {
  const rule = drafts.value[index]
  if (!rule) {
    return
  }
  drafts.value[index] = { ...cloneTrigger(trigger), reactionSource: rule.reactionSource }
  commit()
}

function ruleGestureSummary(rule: ComponentSFCInteractionTriggerProjection): string {
  const held = rule.held?.code.length ? rule.held.code : rule.held?.key ?? []
  const trigger = rule.code.length ? rule.code : rule.key
  const tokens = uniqueTokens([
    ...modifierTokens(rule.modifiers),
    ...held.map(displayCode),
    ...trigger.map(displayCode),
    ...(rule.button == null ? [] : [buttonLabel(rule.button)]),
  ])
  return tokens.length ? tokens.join(' + ') : 'Без условий'
}

function modifierTokens(modifiers: Partial<Record<ComponentSFCTableCellInteractionModifier, boolean>>): string[] {
  const labels: Array<[ComponentSFCTableCellInteractionModifier, string]> = [
    ['mod', 'Ctrl/Cmd'],
    ['ctrl', 'Ctrl'],
    ['shift', 'Shift'],
    ['alt', 'Alt'],
    ['meta', 'Meta'],
    ['altGraph', 'AltGr'],
  ]
  return labels.filter(([name]) => modifiers[name] === true).map(([, label]) => label)
}

function displayCode(code: string): string {
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3)
  }
  if (/^Digit\d$/.test(code)) {
    return code.slice(5)
  }
  return code
}

function buttonLabel(button: number): string {
  return ['ЛКМ', 'Колесо', 'ПКМ', 'Назад', 'Вперёд'][button] ?? `Button ${button}`
}

function uniqueTokens(tokens: string[]): string[] {
  return [...new Set(tokens.filter(Boolean))]
}

function updateReaction(index: number, value: string | null): void {
  const rule = drafts.value[index]
  if (!rule) {
    return
  }
  rule.reactionSource = value?.trim() || defaultReactionSource()
  commit()
}

function defaultReactionSource(): string {
  return `action({ identity: 'action.identity', input: { rowId: rowKey, row, rowIndex, columnKey, value, event: event() } })`
}

function commit(): void {
  emit('update', drafts.value.length ? serializeRules(drafts.value) : null)
}

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
  fields.push(`reaction: ${rule.reactionSource.trim() || serializeAction(undefined)}`)
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
        Событие
      </Button>
    </div>

    <div v-if="!modelValue.editable" class="editor-control flex items-center justify-between gap-4 rounded-lg border border-border/70 px-4 py-3">
      <div class="min-w-0">
        <div class="text-sm font-medium">Аннотация управляется Source</div>
        <div class="mt-0.5 text-xs text-muted-foreground">{{ modelValue.message }}</div>
      </div>
      <Button type="button" variant="outline" size="sm" class="shrink-0 gap-1.5" @click="$emit('openSource')">
        <FileCode2 class="size-3.5" />
        Открыть
      </Button>
    </div>

    <div v-else-if="!drafts.length" class="rounded-lg border border-dashed border-border/70 px-4 py-7 text-center text-xs text-muted-foreground">
      Нет обработчиков. Добавьте только те события, на которые нужна реакция.
    </div>

    <div v-else class="space-y-2">
      <div v-if="modelValue.suffixes.length" class="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        <span>Для всех правил:</span>
        <code v-for="suffix in modelValue.suffixes" :key="suffix" class="rounded bg-muted px-1.5 py-0.5">.{{ suffix }}</code>
      </div>

      <Collapsible
        v-for="(rule, index) in drafts"
        :key="`${index}:${rule.event}`"
        :open="expanded.has(index)"
        class="editor-panel overflow-hidden rounded-lg border border-border/70"
        @update:open="setExpanded(index, $event)"
      >
        <div class="flex min-h-14 items-center gap-2 p-2.5">
          <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left" @click="setExpanded(index, !expanded.has(index))">
            <ChevronDown class="size-4 shrink-0 text-muted-foreground transition-transform" :class="{ '-rotate-90': !expanded.has(index) }" />
            <span class="min-w-0 flex-1">
              <span class="block font-mono text-sm">{{ rule.event }}</span>
              <span class="block truncate text-[11px] text-muted-foreground">{{ ruleGestureSummary(rule) }}</span>
            </span>
          </button>
          <Button type="button" variant="ghost" size="icon" class="size-8 text-muted-foreground hover:text-destructive" aria-label="Удалить обработчик" @click="removeRule(index)">
            <Trash2 class="size-3.5" />
          </Button>
        </div>

        <CollapsibleContent>
          <div class="space-y-4 border-t border-border/60 p-3">
            <ComponentSFCInteractionTriggerEditor
              :model-value="rule"
              :events="events"
              @update:model-value="updateTrigger(index, $event)"
            />

            <ComponentSFCReactionEditor
              :model-value="rule.reactionSource"
              :event-name="rule.event"
              @save="updateReaction(index, $event)"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  </section>
</template>
