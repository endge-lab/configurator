<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { isBusy } from '@/features/endge-ide/model/core/endge-ide-busy.ts'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const props = defineProps<{
  tabContext?: {
    document?: {
      editor?: {
        identity: string
        displayName: string
        description?: string | null
        active?: boolean
        definition?: { steps?: Array<unknown> }
      }
      previewModel?: {
        identity?: string
        name?: string
        displayName?: string
        description?: string | null
        active?: boolean
        definition?: { steps?: Array<unknown> }
      }
      component?: unknown
    }
  }
}>()

const uiText = {
  empty: 'Выберите действие',
  identity: 'Идентификатор',
  displayName: 'Название',
  description: 'Описание',
  steps: 'Количество шагов',
  active: 'Активно',
  save: 'Сохранить',
  saving: 'Сохранение…',
}

const editor = computed(() => props.tabContext?.document?.editor ?? null)
const model = computed(() => props.tabContext?.document?.previewModel ?? props.tabContext?.document?.component ?? editor.value)
const stepsCount = computed(() => {
  const steps = (model.value as { definition?: { steps?: unknown[] } } | null)?.definition?.steps
  return Array.isArray(steps) ? steps.length : 0
})

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <div
    v-if="!model"
    class="flex h-full items-center justify-center text-sm text-muted-foreground"
  >
    {{ uiText.empty }}
  </div>
  <div
    v-else
    class="flex h-full flex-col"
  >
    <ScrollArea class="flex-1">
      <div class="space-y-4 p-4">
        <div class="space-y-2">
          <Label class="text-sm font-medium">
            {{ uiText.identity }}
          </Label>
          <Input
            :model-value="editor?.identity ?? (model as { identity?: string })?.identity ?? ''"
            placeholder="app.configurator.ready"
            @update:model-value="value => editor && (editor.identity = String(value ?? ''))"
          />
        </div>
        <div class="space-y-2">
          <Label class="text-sm font-medium">
            {{ uiText.displayName }}
          </Label>
          <Input
            :model-value="editor?.displayName ?? (model as { displayName?: string })?.displayName ?? (model as { name?: string })?.name ?? ''"
            placeholder="Configurator ready"
            @update:model-value="value => editor && (editor.displayName = String(value ?? ''))"
          />
        </div>
        <div class="space-y-2">
          <Label class="text-sm font-medium">
            {{ uiText.description }}
          </Label>
          <textarea
            :value="editor?.description ?? (model as { description?: string })?.description ?? ''"
            class="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Описание действия"
            @input="event => editor && (editor.description = (event.target as HTMLTextAreaElement).value || null)"
          />
        </div>
        <div class="space-y-2">
          <Label class="text-sm font-medium">
            {{ uiText.steps }}
          </Label>
          <Input
            :model-value="String(stepsCount)"
            disabled
          />
        </div>
        <div class="flex items-center gap-2">
          <Checkbox
            :checked="editor?.active ?? (model as { active?: boolean })?.active ?? true"
            @update:checked="(value: boolean) => editor && (editor.active = value)"
          />
          <Label class="text-sm">
            {{ uiText.active }}
          </Label>
        </div>
      </div>
    </ScrollArea>
    <div class="border-t p-4">
      <Button
        class="w-full"
        :disabled="isBusy"
        @click="save"
      >
        <Loader2
          v-if="isBusy"
          class="mr-2 size-4 animate-spin"
        />
        {{ isBusy ? uiText.saving : uiText.save }}
      </Button>
    </div>
  </div>
</template>
