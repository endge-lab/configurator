<script setup lang="ts">
import type { RFieldEditor } from '@/features/endge-ide/domain/entities/RFieldEditor.ts'
import type { DomainDocumentType } from '@endge/core'

import { Endge } from '@endge/core'
import { Box, ExternalLink, Loader2, Plus, Save } from 'lucide-vue-next'
import { computed, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RFieldEditor as RFieldEditorClass } from '@/features/endge-ide/domain/entities/RFieldEditor.ts'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const PRIMITIVE_TYPES = ['Any', 'ID', 'String', 'Number', 'Boolean', 'Null', 'DateTime', 'Time'] as const

const tabs = EndgeIDE.tabs

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}

/** Примитивы + пользовательские типы домена для выбора типа поля */
const availableTypes = computed(() => {
  const primitives = PRIMITIVE_TYPES.map(t => ({ value: t, label: t, isPrimitive: true }))
  const domainTypes = Endge.domain
    .getTypes()
    .filter(t => !t.isPrimitive)
    .map(t => ({ value: t.name, label: t.name, isPrimitive: false }))
    .sort((a, b) => a.label.localeCompare(b.label))
  return [...primitives, ...domainTypes]
})

function isCustomType(typeName: string): boolean {
  return typeName != null && typeName !== '' && !PRIMITIVE_TYPES.includes(typeName as (typeof PRIMITIVE_TYPES)[number])
}

interface TypeEditorModel {
  name?: string
  fields?: RFieldEditor[]
}

const editor = computed(() => tabs.documentEditorModel.value ?? null)
const fieldRows = computed(() => editor.value?.fields ?? [])

const selectedIndices = ref<Set<number>>(new Set())

const allSelected = computed<boolean>({
  get: () => fieldRows.value.length > 0 && selectedIndices.value.size === fieldRows.value.length,
  set: (v: boolean) => {
    if (v)
      selectedIndices.value = new Set(fieldRows.value.map((_: RFieldEditor, i: number) => i))
    else selectedIndices.value = new Set()
  },
})

function toggleRow(index: number): void {
  const next = new Set(selectedIndices.value)
  if (next.has(index))
    next.delete(index)
  else next.add(index)
  selectedIndices.value = next
}

function removeSelected(): void {
  const ed = editor.value
  if (!ed?.fields?.length)
    return
  const indices = [...selectedIndices.value].sort((a, b) => b - a)
  for (const i of indices) {
    if (i >= 0 && i < ed.fields.length)
      ed.fields.splice(i, 1)
  }
  selectedIndices.value = new Set()
}

function getUniqueFieldName(ed: TypeEditorModel, baseName = 'field'): string {
  const fields = ed.fields
  if (!fields?.length)
    return baseName
  let name = baseName
  let n = 0
  while (fields.some((f: RFieldEditor) => f.name === name)) {
    n += 1
    name = `${baseName}${n}`
  }
  return name
}

function addField(): void {
  const ed = editor.value
  if (!ed?.fields)
    return
  const field = reactive(RFieldEditorClass.createDefault()) as RFieldEditor
  field.name = getUniqueFieldName(ed, 'field')
  ed.fields.push(field)
}

function renameField(row: RFieldEditor, nextRaw: string): void {
  const ed = editor.value
  if (!ed?.fields)
    return
  const nextName = String(nextRaw ?? '').trim()
  if (!nextName || nextName === row.name)
    return
  if (ed.fields.some((f: RFieldEditor) => f !== row && f.name === nextName)) {
    toast.warning('Имя уже занято', { description: nextName })
    return
  }
  row.name = nextName
}

function changeRowField<K extends keyof RFieldEditor>(row: RFieldEditor, field: K, v: RFieldEditor[K]): void {
  row[field] = v
}

function openTypeDocument(typeId: string): void {
  const id = String(typeId).trim()
  if (id === '') {
    toast.warning('Не указан тип')
    return
  }

  const rType = Endge.domain.getType(id)
  if (rType?.isPrimitive) {
    toast.info('Это примитивный тип')
    return
  }

  EndgeIDE.tabs.openDocument(id, 'type' as DomainDocumentType)
}
</script>

<template>
  <div class="w-full h-full">
    <div class="p-5 flex flex-col gap-5 h-full min-h-0">
      <div class="flex items-center gap-3 min-w-0 shrink-0">
        <div class="size-10 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
          <Box class="size-5 text-rose-500" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-lg font-semibold truncate">
            Тип - {{ editor?.name ?? 'Нет документа' }}
          </div>
          <div class="text-xs text-muted-foreground truncate">
            {{ editor?.name ?? '-' }}
          </div>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" aria-label="Сохранить" :disabled="EndgeIDE.busy.value" @click="save">
                <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
                <Save v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Сохранить</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Card class="shrink-0 p-4">
        <div class="mb-3 text-sm font-semibold">Основное</div>
        <div class="max-w-xl space-y-2">
          <Label>Название типа</Label>
          <Input v-model="editor!.name" />
        </div>
      </Card>

      <Card class="flex-1 min-h-0">
        <div class="flex flex-col h-full min-h-0">
          <div class="border-b px-3 py-2 flex items-center justify-between gap-2">
            <button
              v-if="selectedIndices.size > 0"
              type="button"
              class="text-xs text-destructive underline hover:no-underline"
              @click="removeSelected"
            >
              удалить
            </button>
            <span v-else />
            <Button variant="outline" size="icon" class="size-8 shrink-0" @click="addField">
              <Plus class="size-4" />
            </Button>
          </div>

          <ScrollArea class="flex-1 min-h-0">
            <div class="p-4">
              <div class="rounded-lg border overflow-hidden">
                <div class="bg-muted/40 border-b">
                  <div class="grid grid-cols-[40px_1fr_1fr_80px_100px_56px] gap-0 text-xs font-medium text-muted-foreground">
                    <div class="px-2 py-2 flex items-center justify-center">
                      <Checkbox
                        :model-value="allSelected"
                        :indeterminate="selectedIndices.size > 0 && !allSelected"
                        @update:model-value="(v) => (allSelected = v === true)"
                      />
                    </div>
                    <div class="px-3 py-2">
                      Название
                    </div>
                    <div class="px-3 py-2">
                      Тип
                    </div>
                    <div class="px-3 py-2">
                      Массив
                    </div>
                    <div class="px-3 py-2">
                      Необязательное
                    </div>
                    <div class="px-3 py-2">
                      Метод
                    </div>
                  </div>
                </div>

                <div class="divide-y">
                  <div
                    v-for="(row, index) in fieldRows"
                    :key="index"
                    class="grid grid-cols-[40px_1fr_1fr_80px_100px_56px] items-center"
                  >
                    <div class="px-2 py-2 flex items-center justify-center">
                      <Checkbox
                        :model-value="selectedIndices.has(Number(index))"
                        @update:model-value="() => toggleRow(Number(index))"
                      />
                    </div>

                    <div class="px-3 py-2">
                      <Input
                        :model-value="String(row.name ?? '')"
                        @update:model-value="(v) => renameField(row, String(v))"
                      />
                    </div>

                    <div class="px-3 py-2 flex items-center gap-1">
                      <Select
                        :model-value="row.type ?? 'Any'"
                        @update:model-value="(v) => changeRowField(row, 'type', v != null ? String(v) : 'Any')"
                      >
                        <SelectTrigger class="h-8 flex-1 min-w-0">
                          <SelectValue placeholder="Any" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            v-for="opt in availableTypes"
                            :key="opt.value"
                            :value="opt.value"
                          >
                            {{ opt.label }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        v-if="isCustomType(String(row.type ?? ''))"
                        variant="ghost"
                        size="icon"
                        class="size-8 shrink-0 text-muted-foreground hover:text-primary"
                        :title="'Открыть тип ' + String(row.type)"
                        @click="openTypeDocument(String(row.type))"
                      >
                        <ExternalLink class="size-4" />
                      </Button>
                    </div>

                    <div class="px-3 py-2 flex justify-center">
                      <Checkbox
                        :model-value="row.isArray"
                        @update:model-value="(v) => changeRowField(row, 'isArray', v === true)"
                      />
                    </div>

                    <div class="px-3 py-2 flex justify-center">
                      <Checkbox
                        :model-value="row.optional"
                        @update:model-value="(v) => changeRowField(row, 'optional', v === true)"
                      />
                    </div>

                    <div class="px-3 py-2 flex justify-center">
                      <i v-if="(row as any).params?.size > 0" class="ti ti-code text-blue-600" />
                      <span v-else class="text-muted-foreground">-</span>
                    </div>
                  </div>

                  <div v-if="fieldRows.length === 0" class="p-6 text-sm text-muted-foreground">
                    Полей пока нет.
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </Card>
    </div>
  </div>
</template>
