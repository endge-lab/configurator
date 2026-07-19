<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { RActionEditor } from '@/features/endge-ide/domain/entities/RActionEditor'

import { RField } from '@endge/core'
import { useDomainStore } from '@endge/ui-vue'
import { Loader2, Save, Settings2, Workflow } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import EndgeFlowEditor from '@/features/endge-ide/ui/section/action/EndgeFlowEditor.vue'

const props = defineProps<{
  tabContext?: { editor?: RActionEditor }
}>()

const uiText = {
  tabGeneral: 'Основное',
  tabFlow: 'Flow',
  identity: 'Идентификатор',
  displayName: 'Название',
  description: 'Описание',
  inputType: 'Вход',
  outputType: 'Выход',
  type: 'Тип',
  isArray: 'Массив',
  optional: 'Опционально',
  active: 'Активно',
  steps: 'Количество шагов',
}

const editor = computed<RActionEditor | null>(
  () => props.tabContext?.editor ?? null,
)
const flowEditorModel = computed<RActionEditor>({
  get: () => editor.value!,
  set: (value) => {
    if (editor.value && value && value !== editor.value) {
      Object.assign(editor.value, value)
    }
  },
})
const domainStore = useDomainStore()
const activeTab = ref<'general' | 'flow'>('general')
const stepsCount = computed(() => editor.value?.definition?.nodes?.length ?? 0)
const tabButtons = [
  { value: 'general', icon: Settings2, label: uiText.tabGeneral },
  { value: 'flow', icon: Workflow, label: uiText.tabFlow },
] as const

const typeOptions = computed(() => {
  const primitives: Array<{ value: string, label: string }> = (
    domainStore.typesPrimitives ?? []
  ).map((type: { id?: string | number, name?: string }) => ({
    value: type?.id != null ? String(type.id) : String(type?.name ?? ''),
    label: String(type?.name ?? type?.id ?? ''),
  }))

  const custom: Array<{
    value: string
    label: string
    isPrimitive: boolean
  }> = (domainStore.typesComplex ?? domainStore.types ?? [])
    .map(
      (type: {
        id?: string | number
        name?: string
        isPrimitive?: boolean
      }) => ({
        value: type?.id != null ? String(type.id) : String(type?.name ?? ''),
        label: String(type?.name ?? type?.id ?? ''),
        isPrimitive: Boolean(type?.isPrimitive),
      }),
    )
    .filter((type: { isPrimitive: boolean }) => !type.isPrimitive)

  return [
    { value: '', label: '- не выбран -' },
    ...primitives.filter((type: { value: string }) => type.value !== ''),
    ...custom.filter((type: { value: string }) => type.value !== ''),
  ]
})

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}

function ensureField(which: 'input' | 'output'): RField | null {
  if (!editor.value) {
    return null
  }

  if (editor.value[which]) {
    return editor.value[which]
  }

  const field = new RField(which, '', false, false)
  editor.value[which] = field
  return field
}

function updateFieldType(which: 'input' | 'output', value: string): void {
  if (!editor.value) {
    return
  }

  const nextType = value.trim()
  if (!nextType) {
    editor.value[which] = null
    return
  }

  const field = ensureField(which)
  if (!field) {
    return
  }

  field.type = nextType
  field.name = which
}

function updateFieldArray(which: 'input' | 'output', checked: boolean): void {
  const field = ensureField(which)
  if (!field) {
    return
  }
  field.isArray = checked
}

function updateFieldOptional(
  which: 'input' | 'output',
  checked: boolean,
): void {
  const field = ensureField(which)
  if (!field) {
    return
  }
  field.optional = checked
}
</script>

<template>
  <SourceDocumentEditorShell
    v-if="editor"
    :document-id="editor.id"
    :identity="editor.identity"
  >
    <template #center>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip v-for="item in tabButtons" :key="item.value">
            <TooltipTrigger as-child>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === item.value
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground'
                "
                :aria-label="item.label"
                @click="activeTab = item.value"
              >
                <component :is="item.icon" class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ item.label }}</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :disabled="EndgeIDE.busy.value"
                aria-label="Сохранить"
                @click="save"
              >
                <Loader2
                  v-if="EndgeIDE.busy.value"
                  class="size-4 animate-spin"
                />
                <Save v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Сохранить</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <template v-if="activeTab === 'general'">
      <ScrollArea class="h-full min-h-0 flex-1">
        <div class="mx-auto max-w-3xl space-y-4 p-6">
          <div class="space-y-2">
            <Label>{{ uiText.identity }}</Label>
            <Input
              v-model="editor!.identity"
              placeholder="app.configurator.ready"
            />
          </div>

          <div class="space-y-2">
            <Label>{{ uiText.displayName }}</Label>
            <Input
              v-model="editor!.displayName"
              placeholder="Configurator ready"
            />
          </div>

          <div class="space-y-2">
            <Label>{{ uiText.description }}</Label>
            <Textarea
              :model-value="editor?.description ?? ''"
              placeholder="Описание действия"
              @update:model-value="
                (value: string | number) =>
                  editor && (editor.description = String(value || '') || null)
              "
            />
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <Label>{{ uiText.inputType }}</Label>
              <div class="space-y-3 rounded-lg border p-3">
                <div class="space-y-2">
                  <Label class="text-xs text-muted-foreground">{{
                    uiText.type
                  }}</Label>
                  <select
                    :value="editor?.input?.type ?? ''"
                    class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    @change="
                      (event) =>
                        updateFieldType(
                          'input',
                          (event.target as HTMLSelectElement).value,
                        )
                    "
                  >
                    <option
                      v-for="option in typeOptions"
                      :key="`input-${option.value || 'none'}`"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                </div>

                <div class="flex items-center gap-2">
                  <Checkbox
                    :checked="editor?.input?.isArray ?? false"
                    @update:checked="
                      (value: boolean) => updateFieldArray('input', value)
                    "
                  />
                  <Label class="text-sm">{{ uiText.isArray }}</Label>
                </div>

                <div class="flex items-center gap-2">
                  <Checkbox
                    :checked="editor?.input?.optional ?? false"
                    @update:checked="
                      (value: boolean) => updateFieldOptional('input', value)
                    "
                  />
                  <Label class="text-sm">{{ uiText.optional }}</Label>
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <Label>{{ uiText.outputType }}</Label>
              <div class="space-y-3 rounded-lg border p-3">
                <div class="space-y-2">
                  <Label class="text-xs text-muted-foreground">{{
                    uiText.type
                  }}</Label>
                  <select
                    :value="editor?.output?.type ?? ''"
                    class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    @change="
                      (event) =>
                        updateFieldType(
                          'output',
                          (event.target as HTMLSelectElement).value,
                        )
                    "
                  >
                    <option
                      v-for="option in typeOptions"
                      :key="`output-${option.value || 'none'}`"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                </div>

                <div class="flex items-center gap-2">
                  <Checkbox
                    :checked="editor?.output?.isArray ?? false"
                    @update:checked="
                      (value: boolean) => updateFieldArray('output', value)
                    "
                  />
                  <Label class="text-sm">{{ uiText.isArray }}</Label>
                </div>

                <div class="flex items-center gap-2">
                  <Checkbox
                    :checked="editor?.output?.optional ?? false"
                    @update:checked="
                      (value: boolean) => updateFieldOptional('output', value)
                    "
                  />
                  <Label class="text-sm">{{ uiText.optional }}</Label>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <Checkbox
              :checked="editor?.active ?? true"
              @update:checked="
                (value: boolean) => editor && (editor.active = value)
              "
            />
            <Label class="text-sm">
              {{ uiText.active }}
            </Label>
          </div>
          <div class="space-y-2">
            <Label>{{ uiText.steps }}</Label>
            <Input :model-value="String(stepsCount)" disabled />
          </div>
        </div>
      </ScrollArea>
    </template>

    <div v-else class="flex h-full min-h-0 flex-col p-4">
      <EndgeFlowEditor
        v-model="flowEditorModel"
        class="h-full min-h-0 flex-1"
      />
    </div>
  </SourceDocumentEditorShell>
</template>
