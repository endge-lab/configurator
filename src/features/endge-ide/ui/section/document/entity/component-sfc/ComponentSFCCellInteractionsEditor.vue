<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type {
  ComponentSFCTableCellInteractionFlag,
  ComponentSFCTableCellInteractionModifier,
  ComponentSFCTableCellInteractionRuleProjection,
  ComponentSFCTableCellInteractionsProjection,
  RAction,
} from '@endge/core'
import { Endge, getComponentSFCIntrinsicEventDefinitions } from '@endge/core'
import { ChevronDown, FileCode2, Plus, Radio, Trash2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const props = defineProps<{
  modelValue: ComponentSFCTableCellInteractionsProjection
}>()

const emit = defineEmits<{
  (event: 'update', value: string | null): void
  (event: 'openSource'): void
}>()

type RuleDraft = ComponentSFCTableCellInteractionRuleProjection

const events = getComponentSFCIntrinsicEventDefinitions('Cell')
const actions = computed(() => Endge.domain.getActions()
  .filter(action => action.active !== false && Boolean(action.identity?.trim())))
const actionOptions = computed<SearchableSelectOption[]>(() => actions.value.map(action => ({
  value: action.identity,
  label: action.displayName || action.name || action.identity,
})))
const drafts = ref<RuleDraft[]>([])
const expanded = ref<Set<number>>(new Set())

watch(
  () => props.modelValue,
  value => drafts.value = value.rules.map(cloneRule),
  { immediate: true, deep: true },
)

function cloneRule(rule: RuleDraft): RuleDraft {
  return {
    ...rule,
    key: [...rule.key],
    code: [...rule.code],
    held: rule.held ? { ...rule.held, key: [...rule.held.key], code: [...rule.held.code] } : null,
    modifiers: { ...rule.modifiers },
    flags: { ...rule.flags },
  }
}

function createRule(): RuleDraft {
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
    reactionSource: serializeAction(actions.value[0]),
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

function updateEvent(index: number, value: unknown): void {
  const event = String(value ?? '').trim()
  if (!event || !drafts.value[index]) return
  const rule = drafts.value[index]!
  rule.event = event
  const definition = events.find(candidate => candidate.name === event)
  if (definition?.payloadType !== 'ComponentSFCPointerEventPayload') rule.button = null
  commit()
}

function toggleModifier(rule: RuleDraft, modifier: ComponentSFCTableCellInteractionModifier): void {
  const current = rule.modifiers[modifier]
  rule.modifiers[modifier] = current == null ? true : current ? false : undefined
  commit()
}

function toggleFlag(rule: RuleDraft, flag: ComponentSFCTableCellInteractionFlag): void {
  if (flag === 'prevent' && rule.flags.passive) return
  if (flag === 'passive' && rule.flags.prevent) return
  rule.flags[flag] = rule.flags[flag] === true ? undefined : true
  commit()
}

function heldCodes(rule: RuleDraft): string {
  return rule.held?.code.join(', ') ?? ''
}

function updateHeldCodes(rule: RuleDraft, raw: string): void {
  const code = splitList(raw)
  rule.held = code.length
    ? { key: rule.held?.key ?? [], code, match: rule.held?.match ?? 'all', exact: rule.held?.exact ?? false }
    : null
  commit()
}

function updateHeldMatch(rule: RuleDraft, value: unknown): void {
  if (!rule.held) return
  rule.held.match = value === 'any' ? 'any' : 'all'
  commit()
}

function toggleHeldExact(rule: RuleDraft): void {
  if (!rule.held) return
  rule.held.exact = !rule.held.exact
  commit()
}

function updateList(rule: RuleDraft, field: 'key' | 'code', raw: string): void {
  rule[field] = splitList(raw)
  commit()
}

function updateButton(rule: RuleDraft, raw: string): void {
  const value = raw.trim()
  rule.button = value === '' ? null : Number(value)
  if (!Number.isFinite(rule.button)) rule.button = null
  commit()
}

function updateNullableBoolean(rule: RuleDraft, field: 'repeat' | 'composing', value: unknown): void {
  rule[field] = value === 'true' ? true : value === 'false' ? false : null
  commit()
}

function selectedAction(rule: RuleDraft): string | null {
  const match = rule.reactionSource.match(/\bidentity\s*:\s*(['"])(.*?)\1/)
  return match?.[2] && actions.value.some(action => action.identity === match[2]) ? match[2] : null
}

function updateAction(rule: RuleDraft, value: string | string[] | null): void {
  if (!value || Array.isArray(value)) return
  rule.reactionSource = serializeAction(actions.value.find(action => action.identity === value))
  commit()
}

function serializeAction(action: RAction | undefined): string {
  const identity = action?.identity || 'action.identity'
  const params = [...(action?.input?.params?.values() ?? [])]
  const input = action
    ? params.length
      ? `{ ${params.map(param => `${param.name}: ${cellActionInputSource(param.name)}`).join(', ')} }`
      : 'event()'
    : '{ rowId: rowKey, row, rowIndex, columnKey, value, event: event() }'
  return `action({ identity: ${quote(identity)}, input: ${input} })`
}

function cellActionInputSource(name: string): string {
  if (name === 'rowId' || name === 'rowKey') return 'rowKey'
  if (name === 'row' || name === 'rowIndex' || name === 'columnKey' || name === 'value') return name
  if (name === 'event') return 'event()'
  return `event(${quote(name)})`
}

function commit(): void {
  emit('update', drafts.value.length ? serializeRules(drafts.value) : null)
}

function serializeRules(rules: RuleDraft[]): string {
  const serialized = rules.map(serializeRule)
  return serialized.length === 1 ? serialized[0]! : `[\n${serialized.map(rule => `  ${rule}`).join(',\n')}\n]`
}

function serializeRule(rule: RuleDraft): string {
  const fields = [`event: ${quote(rule.event)}`]
  if (rule.key.length) fields.push(`key: ${serializeStringList(rule.key)}`)
  if (rule.code.length) fields.push(`code: ${serializeStringList(rule.code)}`)
  if (rule.held) {
    const held = []
    if (rule.held.key.length) held.push(`key: ${serializeStringList(rule.held.key)}`)
    if (rule.held.code.length) held.push(`code: ${serializeStringList(rule.held.code)}`)
    if (rule.held.match === 'any') held.push(`match: 'any'`)
    if (rule.held.exact) held.push('exact: true')
    if (held.length) fields.push(`held: { ${held.join(', ')} }`)
  }
  const modifiers = Object.entries(rule.modifiers)
    .filter(([, value]) => value != null)
    .map(([name, value]) => `${name}: ${value}`)
  if (modifiers.length) fields.push(`modifiers: { ${modifiers.join(', ')} }`)
  if (rule.repeat != null) fields.push(`repeat: ${rule.repeat}`)
  if (rule.composing != null) fields.push(`composing: ${rule.composing}`)
  if (rule.button != null) fields.push(`button: ${rule.button}`)
  for (const flag of ['stop', 'prevent', 'self', 'once', 'capture', 'passive'] as const) {
    if (rule.flags[flag] === true) fields.push(`${flag}: true`)
  }
  fields.push(`reaction: ${rule.reactionSource.trim() || serializeAction(undefined)}`)
  return `{ ${fields.join(', ')} }`
}

function serializeStringList(values: string[]): string {
  return values.length === 1 ? quote(values[0]!) : `[${values.map(quote).join(', ')}]`
}

function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function splitList(value: string): string[] {
  return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))]
}
</script>

<template>
  <section class="border-b bg-background/10 px-5 py-4">
    <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="flex items-center gap-2 text-sm font-semibold">
          <Radio class="size-4" />
          Обработка событий ячейки
        </h3>
        <p class="mt-1 text-xs text-muted-foreground">
          Реакция получает row, rowIndex, rowKey, columnKey, value и event().
        </p>
      </div>
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
              <span class="block truncate text-[11px] text-muted-foreground">
                {{ Object.keys(rule.modifiers).filter(key => rule.modifiers[key as ComponentSFCTableCellInteractionModifier]).join(' + ') || 'Без модификаторов' }}
              </span>
            </span>
          </button>
          <Button type="button" variant="ghost" size="icon" class="size-8 text-muted-foreground hover:text-destructive" aria-label="Удалить обработчик" @click="removeRule(index)">
            <Trash2 class="size-3.5" />
          </Button>
        </div>

        <CollapsibleContent>
          <div class="space-y-4 border-t border-border/60 p-3">
            <div class="grid gap-3 md:grid-cols-[minmax(180px,0.55fr)_minmax(260px,1.45fr)]">
              <div class="space-y-1.5">
                <Label class="text-xs">Событие</Label>
                <Select :model-value="rule.event" @update:model-value="updateEvent(index, $event)">
                  <SelectTrigger class="editor-control"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="event in events" :key="event.name" :value="event.name">
                      {{ event.displayName }} · {{ event.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs">Модификаторы</Label>
                <div class="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-border/70 p-1">
                  <Button
                    v-for="modifier in (['shift', 'ctrl', 'alt', 'meta', 'mod', 'exact'] as const)"
                    :key="modifier"
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="h-7 px-2 font-mono text-[11px]"
                    :class="rule.modifiers[modifier] === true ? 'bg-primary/12 text-primary' : rule.modifiers[modifier] === false ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300' : 'text-muted-foreground'"
                    :aria-pressed="rule.modifiers[modifier] === true"
                    @click="toggleModifier(rule, modifier)"
                  >
                    {{ rule.modifiers[modifier] === false ? `!${modifier}` : modifier }}
                  </Button>
                </div>
              </div>
            </div>

            <div class="grid gap-3 lg:grid-cols-3">
              <div class="space-y-1.5">
                <Label class="text-xs">Удерживаемые code</Label>
                <Input class="editor-control font-mono text-xs" :model-value="heldCodes(rule)" placeholder="KeyW, KeyE" @change="updateHeldCodes(rule, ($event.target as HTMLInputElement).value)" />
              </div>
              <div v-if="rule.held" class="space-y-1.5">
                <Label class="text-xs">Совпадение held</Label>
                <div class="flex gap-1">
                  <Select :model-value="rule.held.match" @update:model-value="updateHeldMatch(rule, $event)">
                    <SelectTrigger class="editor-control"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Все</SelectItem><SelectItem value="any">Любая</SelectItem></SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="sm" class="h-9" :class="rule.held.exact ? 'border-primary/50 text-primary' : ''" @click="toggleHeldExact(rule)">exact</Button>
                </div>
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs">Button</Label>
                <Input class="editor-control font-mono text-xs" type="number" min="0" max="4" :model-value="rule.button ?? ''" placeholder="Любая" @change="updateButton(rule, ($event.target as HTMLInputElement).value)" />
              </div>
            </div>

            <details class="rounded-md border border-border/60 px-3 py-2">
              <summary class="cursor-pointer text-xs font-medium text-muted-foreground">Дополнительные условия</summary>
              <div class="mt-3 grid gap-3 sm:grid-cols-2">
                <div class="space-y-1.5"><Label class="text-xs">Keyboard key</Label><Input class="editor-control font-mono text-xs" :model-value="rule.key.join(', ')" placeholder="Enter, Escape" @change="updateList(rule, 'key', ($event.target as HTMLInputElement).value)" /></div>
                <div class="space-y-1.5"><Label class="text-xs">Keyboard code</Label><Input class="editor-control font-mono text-xs" :model-value="rule.code.join(', ')" placeholder="Enter, Space" @change="updateList(rule, 'code', ($event.target as HTMLInputElement).value)" /></div>
                <div class="space-y-1.5">
                  <Label class="text-xs">Repeat</Label>
                  <Select :model-value="rule.repeat == null ? 'any' : String(rule.repeat)" @update:model-value="updateNullableBoolean(rule, 'repeat', $event)">
                    <SelectTrigger class="editor-control"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="any">Любое</SelectItem><SelectItem value="true">Только repeat</SelectItem><SelectItem value="false">Без repeat</SelectItem></SelectContent>
                  </Select>
                </div>
                <div class="space-y-1.5">
                  <Label class="text-xs">Composing</Label>
                  <Select :model-value="rule.composing == null ? 'any' : String(rule.composing)" @update:model-value="updateNullableBoolean(rule, 'composing', $event)">
                    <SelectTrigger class="editor-control"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="any">Любое</SelectItem><SelectItem value="true">IME composing</SelectItem><SelectItem value="false">Не composing</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </details>

            <div class="space-y-1.5">
              <Label class="text-xs">Поведение события</Label>
              <div class="flex flex-wrap gap-1">
                <Button
                  v-for="flag in (['stop', 'prevent', 'self', 'once', 'capture', 'passive'] as const)"
                  :key="flag"
                  type="button"
                  variant="outline"
                  size="sm"
                  class="h-7 px-2 font-mono text-[11px]"
                  :class="rule.flags[flag] ? 'border-primary/50 bg-primary/8 text-primary' : 'text-muted-foreground'"
                  :disabled="(flag === 'prevent' && rule.flags.passive) || (flag === 'passive' && rule.flags.prevent)"
                  :aria-pressed="rule.flags[flag] === true"
                  @click="toggleFlag(rule, flag)"
                >
                  {{ flag }}
                </Button>
              </div>
            </div>

            <div class="grid gap-3 md:grid-cols-[minmax(180px,0.55fr)_minmax(260px,1.45fr)]">
              <div class="space-y-1.5">
                <Label class="text-xs">Action</Label>
                <SearchableSelect :options="actionOptions" :model-value="selectedAction(rule)" placeholder="Выбрать Action..." trigger-class="editor-control w-full" @update:model-value="updateAction(rule, $event)" />
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs">Reaction</Label>
                <Textarea v-model="rule.reactionSource" class="editor-control min-h-20 font-mono text-xs" spellcheck="false" @blur="commit" />
                <p class="text-[10px] text-muted-foreground">Можно указать action(), query(), emit(), typescript() или их массив.</p>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  </section>
</template>
