<script setup lang="ts">
import type { RActionEditor } from '@/features/endge-ide/domain/entities/RActionEditor'

import { RField } from '@endge/core'
import { useDomainStore } from '@endge/vue'
import { Loader2, Save, Zap } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { isBusy } from '@/features/endge-ide/model/core/endge-ide-busy.ts'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import EndgeFlowEditor from '@/features/endge-ide/ui/section/action/EndgeFlowEditor.vue'

const props = defineProps<{
  tabContext?: { editor?: RActionEditor }
}>()

const uiText = {
  titleFallback: 'Новое действие',
  save: 'Сохранить',
  tabAction: 'Action',
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
  headerMetaFallback: '-',
  headerMetaSeparator: ' | ',
}

const editor = computed<RActionEditor | null>(() => props.tabContext?.editor ?? null)
const flowEditorModel = computed<RActionEditor>({
  get: () => editor.value!,
  set: (value) => {
    if (editor.value && value && value !== editor.value)
      Object.assign(editor.value, value)
  },
})
const domainStore = useDomainStore()
const activeTab = ref<'action' | 'flow'>('action')

const typeOptions = computed(() => {
  const primitives = (domainStore.typesPrimitives ?? []).map((type: { id?: string | number, name?: string }) => ({
    value: type?.id != null ? String(type.id) : String(type?.name ?? ''),
    label: String(type?.name ?? type?.id ?? ''),
  }))

  const custom = (domainStore.typesComplex ?? domainStore.types ?? [])
    .map((type: { id?: string | number, name?: string, isPrimitive?: boolean }) => ({
      value: type?.id != null ? String(type.id) : String(type?.name ?? ''),
      label: String(type?.name ?? type?.id ?? ''),
      isPrimitive: Boolean(type?.isPrimitive),
    }))
    .filter(type => !type.isPrimitive)

  return [
    { value: '', label: '- не выбран -' },
    ...primitives.filter(type => type.value !== ''),
    ...custom.filter(type => type.value !== ''),
  ]
})

const headerMetaText = computed(() => {
  const actionEditor = editor.value
  const id = actionEditor?.id != null ? String(actionEditor.id) : uiText.headerMetaFallback
  const identity = actionEditor?.identity?.trim() || uiText.headerMetaFallback
  return [`id: ${id}`, `identity: ${identity}`].join(uiText.headerMetaSeparator)
})

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}

function ensureField(which: 'input' | 'output'): RField | null {
  if (!editor.value)
    return null

  if (editor.value[which])
    return editor.value[which]

  const field = new RField(which, '', false, false)
  editor.value[which] = field
  return field
}

function updateFieldType(which: 'input' | 'output', value: string): void {
  if (!editor.value)
    return

  const nextType = value.trim()
  if (!nextType) {
    editor.value[which] = null
    return
  }

  const field = ensureField(which)
  if (!field)
    return

  field.type = nextType
  field.name = which
}

function updateFieldArray(which: 'input' | 'output', checked: boolean): void {
  const field = ensureField(which)
  if (!field)
    return
  field.isArray = checked
}

function updateFieldOptional(which: 'input' | 'output', checked: boolean): void {
  const field = ensureField(which)
  if (!field)
    return
  field.optional = checked
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex shrink-0 items-center gap-3 border-b p-3">
      <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
        <Zap class="size-4 text-amber-500" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-lg font-semibold">
          {{ editor?.displayName || editor?.identity || uiText.titleFallback }}
        </div>
        <div class="truncate text-xs text-muted-foreground">
          {{ headerMetaText }}
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        :disabled="isBusy"
        @click="save"
      >
        <Loader2
          v-if="isBusy"
          class="mr-1 size-4 animate-spin"
        />
        <Save
          v-else
          class="mr-1 size-4"
        />
        {{ uiText.save }}
      </Button>
    </div>

    <div class="flex min-h-0 flex-1 flex-col p-0">
      <Card class="flex h-full min-h-0 flex-col gap-0 overflow-hidden py-0">
        <Tabs
          v-model="activeTab"
          class="flex h-full min-h-0 flex-col"
        >
          <div class="border-b px-3 py-2">
            <TabsList class="grid w-full grid-cols-2">
              <TabsTrigger value="action">
                {{ uiText.tabAction }}
              </TabsTrigger>
              <TabsTrigger value="flow">
                {{ uiText.tabFlow }}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="action"
            class="m-0 flex-1 min-h-0 p-0 data-[state=inactive]:hidden"
          >
            <ScrollArea class="h-full min-h-0 flex-1">
              <div class="space-y-4 p-4">
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
                    @update:model-value="value => editor && (editor.description = String(value || '') || null)"
                  />
                </div>

                <div class="grid gap-4 md:grid-cols-2">
                  <div class="space-y-2">
                    <Label>{{ uiText.inputType }}</Label>
                    <div class="space-y-3 rounded-lg border p-3">
                      <div class="space-y-2">
                        <Label class="text-xs text-muted-foreground">{{ uiText.type }}</Label>
                        <select
                          :value="editor?.input?.type ?? ''"
                          class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          @change="event => updateFieldType('input', (event.target as HTMLSelectElement).value)"
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
                          @update:checked="value => updateFieldArray('input', !!value)"
                        />
                        <Label class="text-sm">{{ uiText.isArray }}</Label>
                      </div>

                      <div class="flex items-center gap-2">
                        <Checkbox
                          :checked="editor?.input?.optional ?? false"
                          @update:checked="value => updateFieldOptional('input', !!value)"
                        />
                        <Label class="text-sm">{{ uiText.optional }}</Label>
                      </div>
                    </div>
                  </div>

                  <div class="space-y-2">
                    <Label>{{ uiText.outputType }}</Label>
                    <div class="space-y-3 rounded-lg border p-3">
                      <div class="space-y-2">
                        <Label class="text-xs text-muted-foreground">{{ uiText.type }}</Label>
                        <select
                          :value="editor?.output?.type ?? ''"
                          class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          @change="event => updateFieldType('output', (event.target as HTMLSelectElement).value)"
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
                          @update:checked="value => updateFieldArray('output', !!value)"
                        />
                        <Label class="text-sm">{{ uiText.isArray }}</Label>
                      </div>

                      <div class="flex items-center gap-2">
                        <Checkbox
                          :checked="editor?.output?.optional ?? false"
                          @update:checked="value => updateFieldOptional('output', !!value)"
                        />
                        <Label class="text-sm">{{ uiText.optional }}</Label>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <Checkbox
                    :checked="editor?.active ?? true"
                    @update:checked="value => editor && (editor.active = !!value)"
                  />
                  <Label class="text-sm">
                    {{ uiText.active }}
                  </Label>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent
            value="flow"
            class="m-0 flex-1 min-h-0 p-0 data-[state=inactive]:hidden"
          >
            <div class="flex h-full min-h-0 flex-col p-4">
              <EndgeFlowEditor
                v-if="editor && activeTab === 'flow'"
                v-model="flowEditorModel"
                class="h-full min-h-0 flex-1"
              />
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  </div>
</template>
