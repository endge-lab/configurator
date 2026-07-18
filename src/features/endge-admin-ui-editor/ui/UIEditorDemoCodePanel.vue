<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { UIEditorDemoState } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'

import { Check, Copy } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const props = defineProps<{
  state: UIEditorDemoState
}>()

const copied = ref(false)
const generatedSource = computed(() => props.state.toSFCSource())
const sourceLines = computed(() => generatedSource.value.replace(/\n$/, '').split('\n'))

async function copySource(): Promise<void> {
  if (!navigator.clipboard) {
    return
  }

  await navigator.clipboard.writeText(generatedSource.value)
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1400)
}
</script>

<template>
  <aside class="flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-slate-800 bg-[#0b1120] pt-12 text-slate-200">
    <div class="flex h-10 shrink-0 items-center justify-between border-y border-slate-800/90 bg-slate-950/60 px-3">
      <div class="flex min-w-0 items-center gap-2">
        <span class="size-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.12)]" />
        <span class="truncate font-mono text-[11px] font-medium text-slate-300">
          Component.endge
        </span>
        <span class="rounded border border-slate-700 bg-slate-800/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Live
        </span>
      </div>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-7 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            :aria-label="copied ? 'Код скопирован' : 'Копировать SFC source'"
            @click="copySource"
          >
            <Check v-if="copied" class="size-3.5 text-emerald-400" />
            <Copy v-else class="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ copied ? 'Скопировано' : 'Копировать SFC source' }}</TooltipContent>
      </Tooltip>
    </div>

    <div class="min-h-0 flex-1 overflow-auto py-3 font-mono text-[12px] leading-6">
      <div
        v-for="(line, index) in sourceLines"
        :key="index"
        class="group flex min-w-max pr-6 hover:bg-sky-400/[0.035]"
      >
        <span class="sticky left-0 w-11 shrink-0 select-none border-r border-slate-800/80 bg-[#0b1120] pr-3 text-right text-slate-600 group-hover:text-slate-500">
          {{ index + 1 }}
        </span>
        <code class="whitespace-pre pl-4 text-slate-300">{{ line || ' ' }}</code>
      </div>
    </div>

    <div class="flex h-7 shrink-0 items-center justify-between border-t border-slate-800/90 bg-slate-950/50 px-3 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
      <span>Endge SFC</span>
      <span>{{ sourceLines.length }} lines</span>
    </div>
  </aside>
</template>
