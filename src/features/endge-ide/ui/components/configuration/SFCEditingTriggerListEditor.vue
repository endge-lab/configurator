<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type {
  ComponentSFCInteractionTrigger,
  ComponentSFCInteractionTriggerProjection,
} from '@endge/core'

import { COMPONENT_SFC_INTERACTION_EVENT_DEFINITIONS } from '@endge/core'
import { Plus, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import ComponentSFCInteractionTriggerEditor from '@/features/endge-ide/ui/section/document/entity/component-sfc/ComponentSFCInteractionTriggerEditor.vue'

const props = defineProps<{
  modelValue: ComponentSFCInteractionTrigger[]
  kind: 'cancel' | 'commit'
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ComponentSFCInteractionTrigger[]]
}>()

const triggers = computed(() => props.modelValue.map(toProjection))

function updateTrigger(index: number, value: ComponentSFCInteractionTriggerProjection): void {
  const next = triggers.value.map(cloneProjection)
  next[index] = cloneProjection(value)
  publish(next)
}

function addTrigger(): void {
  const next = triggers.value.map(cloneProjection)
  next.push(props.kind === 'cancel'
    ? createProjection('focusout')
    : {
        ...createProjection('keydown'),
        key: ['Enter'],
        code: ['Enter'],
        flags: { prevent: true },
      })
  publish(next)
}

function removeTrigger(index: number): void {
  publish(triggers.value.filter((_, triggerIndex) => triggerIndex !== index))
}

function publish(value: ComponentSFCInteractionTriggerProjection[]): void {
  emit('update:modelValue', value.map(fromProjection))
}

function triggerLabel(trigger: ComponentSFCInteractionTriggerProjection): string {
  if (trigger.event === 'focusout' || trigger.event === 'blur') {
    return 'Потеря фокуса'
  }
  const keys = trigger.code.length ? trigger.code : trigger.key
  return keys.length ? `${trigger.event} · ${keys.join(' / ')}` : trigger.event
}

function createProjection(event: string): ComponentSFCInteractionTriggerProjection {
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

function toProjection(trigger: ComponentSFCInteractionTrigger): ComponentSFCInteractionTriggerProjection {
  const flags: ComponentSFCInteractionTriggerProjection['flags'] = {}
  for (const name of ['stop', 'prevent', 'self', 'once', 'capture', 'passive'] as const) {
    if (trigger[name] != null) {
      flags[name] = trigger[name]
    }
  }
  return {
    event: trigger.event,
    key: [...(trigger.key ?? [])],
    code: [...(trigger.code ?? [])],
    held: trigger.held
      ? {
          key: [...(trigger.held.key ?? [])],
          code: [...(trigger.held.code ?? [])],
          match: trigger.held.match ?? 'all',
          exact: trigger.held.exact ?? false,
        }
      : null,
    modifiers: { ...(trigger.modifiers ?? {}) },
    repeat: trigger.repeat ?? null,
    composing: trigger.composing ?? null,
    button: trigger.button ?? null,
    flags,
  }
}

function fromProjection(trigger: ComponentSFCInteractionTriggerProjection): ComponentSFCInteractionTrigger {
  return {
    event: trigger.event.trim(),
    ...(trigger.key.length ? { key: [...trigger.key] } : {}),
    ...(trigger.code.length ? { code: [...trigger.code] } : {}),
    ...(trigger.held
      ? {
          held: {
            ...(trigger.held.key.length ? { key: [...trigger.held.key] } : {}),
            ...(trigger.held.code.length ? { code: [...trigger.held.code] } : {}),
            ...(trigger.held.match !== 'all' ? { match: trigger.held.match } : {}),
            ...(trigger.held.exact ? { exact: true } : {}),
          },
        }
      : {}),
    ...(Object.keys(trigger.modifiers).length
      ? { modifiers: { ...trigger.modifiers } }
      : {}),
    ...(trigger.repeat != null ? { repeat: trigger.repeat } : {}),
    ...(trigger.composing != null ? { composing: trigger.composing } : {}),
    ...(trigger.button != null ? { button: trigger.button } : {}),
    ...Object.fromEntries(
      Object.entries(trigger.flags).filter(([, value]) => value != null),
    ),
  }
}

function cloneProjection(trigger: ComponentSFCInteractionTriggerProjection): ComponentSFCInteractionTriggerProjection {
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
  <div class="space-y-3">
    <div
      v-if="!triggers.length"
      class="rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground"
    >
      Trigger-ы не заданы. Режим можно будет завершить только semantic event-ом редактора.
    </div>

    <div
      v-for="(trigger, index) in triggers"
      :key="`${index}:${trigger.event}`"
      class="overflow-hidden rounded-md border border-border/70"
    >
      <div class="flex h-8 items-center justify-between border-b border-border/60 bg-muted/15 px-2.5">
        <code class="text-[10px] font-medium">{{ triggerLabel(trigger) }}</code>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="size-6 text-muted-foreground hover:text-destructive"
          :disabled="disabled"
          :aria-label="`Удалить trigger ${index + 1}`"
          @click="removeTrigger(index)"
        >
          <Trash2 class="size-3.5" />
        </Button>
      </div>
      <div class="p-3" :class="disabled ? 'pointer-events-none opacity-60' : ''">
        <ComponentSFCInteractionTriggerEditor
          :model-value="trigger"
          :events="COMPONENT_SFC_INTERACTION_EVENT_DEFINITIONS"
          @update:model-value="updateTrigger(index, $event)"
        />
      </div>
    </div>

    <Button
      type="button"
      variant="outline"
      size="sm"
      class="h-8 gap-1.5"
      :disabled="disabled"
      @click="addTrigger"
    >
      <Plus class="size-3.5" />
      Альтернативный trigger
    </Button>
  </div>
</template>
