<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { RActionEditor } from '@/features/endge-ide/domain/entities/RActionEditor'

import { Endge, RField } from '@endge/core'
import { useDomainStore } from '@endge/ui-vue'
import { Loader2, Plus, Save, Settings2, Trash2, Workflow } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useSmartTabSelection } from '@/components/ui/smart-tabs'
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
const activeTab = useSmartTabSelection('editor.active-tab', 'general', ['general', 'flow'] as const)
const overrideVersion = ref(0)
const unsubscribeActions = Endge.actions.subscribe(() => {
  overrideVersion.value += 1
  const effective = Endge.actions.listResolved().find(action => action.identity === editor.value?.identity)
  if (!editor.value) return
  editor.value.overridden = effective?.overridden === true
  editor.value.effectiveProviderKey = effective?.effectiveProviderKey ?? null
  editor.value.effectiveProviderOrigin = effective?.effectiveProviderOrigin?.kind ?? null
  editor.value.bindingScope = effective?.bindingScope ?? null
  if (editor.value.overridden && activeTab.value === 'flow')
    activeTab.value = 'general'
})
onBeforeUnmount(unsubscribeActions)
const isOverridden = computed(() => {
  void overrideVersion.value
  return editor.value?.overridden === true
})
watch(isOverridden, (overridden) => {
  if (overridden && activeTab.value === 'flow')
    activeTab.value = 'general'
}, { immediate: true })
const stepsCount = computed(() => editor.value?.definition?.nodes?.length ?? 0)
const tabButtons = computed(() => [
  { value: 'general' as const, icon: Settings2, label: uiText.tabGeneral },
  ...(!isOverridden.value
    ? [{ value: 'flow' as const, icon: Workflow, label: uiText.tabFlow }]
    : []),
])

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

function addTarget(): void {
  if (!editor.value || isOverridden.value) return
  editor.value.target = [...(editor.value.target ?? []), { type: '' }]
}

function removeTarget(index: number): void {
  if (!editor.value || isOverridden.value) return
  const next = [...(editor.value.target ?? [])]
  next.splice(index, 1)
  editor.value.target = next.length ? next : null
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
                    ? 'bg-editor-control shadow-sm'
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
          <div
            v-if="isOverridden"
            class="rounded-md border border-violet-300/60 bg-violet-500/10 p-3 text-sm"
          >
            <div class="font-medium">Логика Action переопределена локальным provider</div>
            <div class="mt-1 text-muted-foreground">
              {{ editor.effectiveProviderKey }} · {{ editor.effectiveProviderOrigin }} · {{ editor.bindingScope }}
            </div>
            <div class="mt-1 text-muted-foreground">
              Default: {{ JSON.stringify(editor.defaultImplementation) }}
            </div>
            <div class="mt-1 text-muted-foreground">
              Identity, target, input/output и сохранённый Flow доступны только для чтения.
            </div>
          </div>
          <div class="space-y-2">
            <Label>{{ uiText.identity }}</Label>
            <Input
              v-model="editor!.identity"
              :disabled="isOverridden"
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
                    class="flex h-9 w-full rounded-md border border-input bg-editor-control px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    :disabled="isOverridden"
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
                    :disabled="isOverridden"
                    @update:checked="
                      (value: boolean) => updateFieldArray('input', value)
                    "
                  />
                  <Label class="text-sm">{{ uiText.isArray }}</Label>
                </div>

                <div class="flex items-center gap-2">
                  <Checkbox
                    :checked="editor?.input?.optional ?? false"
                    :disabled="isOverridden"
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
                    class="flex h-9 w-full rounded-md border border-input bg-editor-control px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    :disabled="isOverridden"
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
                    :disabled="isOverridden"
                    @update:checked="
                      (value: boolean) => updateFieldArray('output', value)
                    "
                  />
                  <Label class="text-sm">{{ uiText.isArray }}</Label>
                </div>

                <div class="flex items-center gap-2">
                  <Checkbox
                    :checked="editor?.output?.optional ?? false"
                    :disabled="isOverridden"
                    @update:checked="
                      (value: boolean) => updateFieldOptional('output', value)
                    "
                  />
                  <Label class="text-sm">{{ uiText.optional }}</Label>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-2 rounded-lg border p-3">
            <div class="flex items-center justify-between gap-2">
              <div>
                <Label>Runtime target</Label>
                <p class="text-xs text-muted-foreground">Селекторы являются альтернативами; один запуск получает одну цель.</p>
              </div>
              <Button v-if="!isOverridden" type="button" size="sm" variant="outline" @click="addTarget">
                <Plus class="mr-1 size-3.5" /> Добавить
              </Button>
            </div>
            <div v-if="!editor.target?.length" class="text-sm text-muted-foreground">Target не требуется</div>
            <div v-for="(target, index) in editor.target ?? []" :key="index" class="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <Input v-model="target.type" :disabled="isOverridden" placeholder="component.table" />
              <Input v-model="target.identity" :disabled="isOverridden" placeholder="identity (optional)" />
              <Button v-if="!isOverridden" type="button" size="icon" variant="ghost" @click="removeTarget(index)">
                <Trash2 class="size-4" />
              </Button>
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
