<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type {
  ComponentSFCEditOutcomeProjection,
  ComponentSFCInteractionTriggerProjection,
} from '@endge/core'

import { COMPONENT_SFC_INTERACTION_EVENT_DEFINITIONS } from '@endge/core'
import { ChevronDown, GitBranchPlus, Plus, RotateCcw, Trash2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'

import ComponentSFCInteractionTriggerEditor from './ComponentSFCInteractionTriggerEditor.vue'

const props = defineProps<{
  cancel: ComponentSFCEditOutcomeProjection
  commit: ComponentSFCEditOutcomeProjection
}>()

const emit = defineEmits<{
  (event: 'updateCancel', value: ComponentSFCInteractionTriggerProjection[] | null): void
  (event: 'updateCommit', value: ComponentSFCInteractionTriggerProjection[] | null): void
}>()

const expanded = ref<'cancel' | 'commit' | null>(null)
const rows = computed(() => [
  {
    kind: 'cancel' as const,
    label: 'Отмена',
    description: 'Черновик сбрасывается без события edited.',
    projection: props.cancel,
  },
  {
    kind: 'commit' as const,
    label: 'Сохранение',
    description: 'Публикуется edited с новым и предыдущим значением.',
    projection: props.commit,
  },
])

function updateTrigger(
  kind: 'cancel' | 'commit',
  index: number,
  value: ComponentSFCInteractionTriggerProjection,
): void {
  const triggers = source(kind).map(cloneTrigger)
  triggers[index] = cloneTrigger(value)
  publish(kind, triggers)
}

function addTrigger(kind: 'cancel' | 'commit'): void {
  const triggers = source(kind).map(cloneTrigger)
  const trigger = createTrigger(kind === 'cancel' ? 'focusout' : 'keydown')
  if (kind === 'commit') {
    trigger.key = ['Enter']
    trigger.flags.prevent = true
  }
  triggers.push(trigger)
  publish(kind, triggers)
}

function removeTrigger(kind: 'cancel' | 'commit', index: number): void {
  const triggers = source(kind).filter((_, triggerIndex) => triggerIndex !== index).map(cloneTrigger)
  publish(kind, triggers)
}

function inherit(kind: 'cancel' | 'commit'): void {
  publish(kind, null)
}

function override(kind: 'cancel' | 'commit'): void {
  publish(kind, source(kind).map(cloneTrigger))
  expanded.value = kind
}

function toggleExpanded(kind: 'cancel' | 'commit', inherited: boolean): void {
  if (!inherited) {
    expanded.value = expanded.value === kind ? null : kind
  }
}

function setExpanded(kind: 'cancel' | 'commit', inherited: boolean, value: boolean): void {
  if (!inherited) {
    expanded.value = value ? kind : null
  }
}

function source(kind: 'cancel' | 'commit'): ComponentSFCInteractionTriggerProjection[] {
  return kind === 'cancel' ? props.cancel.triggers : props.commit.triggers
}

function publish(kind: 'cancel' | 'commit', triggers: ComponentSFCInteractionTriggerProjection[] | null): void {
  if (kind === 'cancel') {
    emit('updateCancel', triggers)
  }
  else {
    emit('updateCommit', triggers)
  }
}

function triggerLabel(trigger: ComponentSFCInteractionTriggerProjection): string {
  if (trigger.event === 'focusout') {
    return 'Потеря фокуса'
  }
  if (trigger.event === 'keydown' && trigger.key.length) {
    return trigger.key.join(' / ')
  }
  const key = trigger.key.length ? ` · ${trigger.key.join(' / ')}` : ''
  return `${trigger.event}${key}`
}

function createTrigger(event: string): ComponentSFCInteractionTriggerProjection {
  return {
    event,
    key: [],
    code: [],
    held: null,
    modifiers: {},
    repeat: null,
    composing: null,
    button: null,
    flags: {},
  }
}

function cloneTrigger(trigger: ComponentSFCInteractionTriggerProjection): ComponentSFCInteractionTriggerProjection {
  return {
    ...trigger,
    key: [...trigger.key],
    code: [...trigger.code],
    held: trigger.held
      ? { ...trigger.held, key: [...trigger.held.key], code: [...trigger.held.code] }
      : null,
    modifiers: { ...trigger.modifiers },
    flags: { ...trigger.flags },
  }
}
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-border/70">
    <div class="border-b border-border/60 bg-muted/20 px-3 py-2">
      <div class="text-sm font-medium">
        Завершение редактирования
      </div>
    </div>

    <div class="divide-y divide-border/60">
      <Collapsible
        v-for="row in rows"
        :key="row.kind"
        :open="!row.projection.usesDefault && expanded === row.kind"
        @update:open="setExpanded(row.kind, row.projection.usesDefault, $event)"
      >
        <div class="flex min-h-14 items-center gap-3 px-3 py-2">
          <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left" @click="toggleExpanded(row.kind, row.projection.usesDefault)">
            <ChevronDown class="size-4 shrink-0 text-muted-foreground transition-transform" :class="{ '-rotate-90': row.projection.usesDefault || expanded !== row.kind }" />
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2 text-sm font-medium">
                {{ row.label }}
                <Badge v-if="row.projection.usesDefault" variant="secondary" class="h-4 px-1.5 text-[9px]">
                  Наследуется
                </Badge>
              </span>
              <span class="mt-1 flex flex-wrap gap-1">
                <code v-for="(trigger, index) in row.projection.triggers" :key="`${index}:${trigger.event}`" class="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {{ triggerLabel(trigger) }}
                </code>
              </span>
            </span>
          </button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="h-7 shrink-0 gap-1.5 px-2 text-[11px]"
            @click.stop="row.projection.usesDefault ? override(row.kind) : inherit(row.kind)"
          >
            <GitBranchPlus v-if="row.projection.usesDefault" class="size-3.5" />
            <RotateCcw v-else class="size-3.5" />
            {{ row.projection.usesDefault ? 'Переопределить' : 'Наследовать' }}
          </Button>
        </div>

        <CollapsibleContent>
          <div class="space-y-3 border-t border-border/60 bg-background/30 p-3">
            <p class="text-xs text-muted-foreground">
              {{ row.description }}
            </p>
            <div v-for="(trigger, index) in row.projection.triggers" :key="`${index}:${trigger.event}`" class="overflow-hidden rounded-md border border-border/70">
              <div class="flex items-center justify-between border-b border-border/60 bg-muted/15 px-2.5 py-1.5">
                <code class="text-[10px] font-medium">{{ triggerLabel(trigger) }}</code>
                <Button type="button" variant="ghost" size="icon" class="size-6 text-muted-foreground hover:text-destructive" :aria-label="`Удалить trigger ${index + 1}`" @click="removeTrigger(row.kind, index)">
                  <Trash2 class="size-3.5" />
                </Button>
              </div>
              <div class="p-3">
                <ComponentSFCInteractionTriggerEditor :model-value="trigger" :events="COMPONENT_SFC_INTERACTION_EVENT_DEFINITIONS" @update:model-value="updateTrigger(row.kind, index, $event)" />
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" class="gap-1.5" @click="addTrigger(row.kind)">
              <Plus class="size-3.5" />
              Альтернативный trigger
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  </div>
</template>
