<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text, style/max-statements-per-line */
import type {
  ExtractComponentDialogDependency,
  ExtractComponentDialogInput,
  ExtractComponentDialogResult,
} from './extract-component.types'

import { Box, Braces, CircleAlert, FolderTree } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import {
  parseExtractComponentPropsJson,
  serializeExtractComponentPropsJson,
} from './extract-component.props-json'
import ExtractComponentFolderPicker from './ExtractComponentFolderPicker.vue'

const props = defineProps<{
  open: boolean
  input: ExtractComponentDialogInput
}>()

const emit = defineEmits<{
  'submit': [result: ExtractComponentDialogResult]
  'cancel': []
  'update:open': [open: boolean]
}>()

const name = ref('')
const identity = ref('')
const tag = ref('')
const dependencies = ref<ExtractComponentDialogDependency[]>([])
const propsJson = ref('{}')
const selectedFolderId = ref<string | null>(null)

const openModel = computed({
  get: () => props.open,
  set: value => emit('update:open', value),
})

const hasWrites = computed(() => props.input.column.dependencies.some(dependency => dependency.hasWrite))
const normalizedTag = computed(() => tag.value.trim())
const tagIsValid = computed(() => {
  if (!normalizedTag.value) { return true }
  return /^[A-Z_$][\w$-]*(?:\.[A-Z_$][\w$-]*)*$/i.test(normalizedTag.value)
})
const parsedProps = computed(() => parseExtractComponentPropsJson(propsJson.value, dependencies.value))
const formIsValid = computed(() => Boolean(
  name.value.trim()
  && identity.value.trim()
  && tagIsValid.value
  && parsedProps.value.dependencies,
))

watch(
  () => [props.open, props.input] as const,
  ([open]) => {
    if (!open) { return }

    name.value = props.input.suggestedName
    identity.value = props.input.suggestedIdentity
    tag.value = props.input.suggestedTag
    dependencies.value = props.input.column.dependencies.map(dependency => ({
      propName: dependency.propName,
      sourceExpression: dependency.sourceExpression,
      type: dependency.type,
      paths: [...dependency.paths],
    }))
    propsJson.value = serializeExtractComponentPropsJson(dependencies.value)
    selectedFolderId.value = null
  },
  { immediate: true },
)

function submit(): void {
  if (!formIsValid.value || hasWrites.value) { return }

  emit('submit', {
    name: name.value.trim(),
    identity: identity.value.trim(),
    tag: normalizedTag.value || null,
    folderId: selectedFolderId.value,
    dependencies: parsedProps.value.dependencies!,
  })
}
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent class="overflow-hidden p-0 sm:max-w-[1060px]">
      <DialogHeader class="border-b bg-muted/30 px-6 py-5">
        <div class="flex items-start gap-3 pr-8">
          <div class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border bg-background shadow-sm">
            <Box class="size-4 text-emerald-500" />
          </div>
          <div class="min-w-0 space-y-1">
            <DialogTitle>Экспорт компонента</DialogTitle>
            <p class="text-sm text-muted-foreground">
              Разметка колонки станет отдельным SFC, а таблица получит ссылку на него.
            </p>
          </div>
        </div>
      </DialogHeader>

      <div class="grid min-h-0 gap-5 px-6 py-5 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_300px_260px]">
        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="extract-component-name">Название</Label>
            <Input id="extract-component-name" v-model="name" autofocus />
          </div>

          <div class="space-y-2">
            <Label for="extract-component-identity">Identity</Label>
            <Input id="extract-component-identity" v-model="identity" class="font-mono" spellcheck="false" />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-3">
              <Label for="extract-component-tag">Tag</Label>
              <span class="text-[11px] text-muted-foreground">optional</span>
            </div>
            <Input
              id="extract-component-tag"
              v-model="tag"
              class="font-mono"
              placeholder="Tail или Module.SomeTag"
              spellcheck="false"
            />
            <p v-if="!tagIsValid" class="text-xs text-destructive">
              Tag должен состоять из допустимых сегментов, разделённых точкой.
            </p>
            <div v-else class="flex items-center gap-2 text-xs text-muted-foreground">
              <code class="rounded border bg-muted/50 px-1.5 py-0.5">
                {{ normalizedTag ? `<${normalizedTag} />` : `<Component is=&quot;${identity || 'identity'}&quot; />` }}
              </code>
            </div>
          </div>
        </div>

        <aside class="min-w-0 overflow-hidden rounded-lg border bg-muted/20">
          <div class="flex items-center justify-between border-b px-3 py-2.5">
            <div class="flex items-center gap-2 text-sm font-medium">
              <Braces class="size-4 text-sky-500" />
              Входные данные
            </div>
            <Badge variant="outline" class="font-mono text-[10px]">
              {{ dependencies.length }} props
            </Badge>
          </div>

          <div class="space-y-2 p-3">
            <Textarea
              v-model="propsJson"
              class="min-h-[220px] resize-none bg-background font-mono text-xs leading-5"
              :class="parsedProps.error ? 'border-destructive focus-visible:ring-destructive/30' : ''"
              spellcheck="false"
              aria-label="Props JSON"
            />
            <p v-if="parsedProps.error" class="text-xs text-destructive">
              {{ parsedProps.error }}
            </p>
            <p v-else class="text-[11px] leading-4 text-muted-foreground">
              Ключ — имя prop, значение — TypeScript type. Source expressions определены автоматически.
            </p>
          </div>
        </aside>

        <aside class="min-w-0 overflow-hidden rounded-lg border bg-muted/20 md:col-span-2 lg:col-span-1">
          <div class="flex items-center gap-2 border-b px-3 py-2.5 text-sm font-medium">
            <FolderTree class="size-4 text-amber-500" />
            Папка компонента
          </div>

          <div class="space-y-3 p-3">
            <ExtractComponentFolderPicker
              v-model="selectedFolderId"
              :options="input.folderOptions"
            />
            <p class="text-xs leading-5 text-muted-foreground">
              По умолчанию компонент будет создан в корне секции «Компоненты».
            </p>
            <div class="rounded-md border border-dashed bg-background/60 px-3 py-2 text-[11px] text-muted-foreground">
              Доступно папок: <span class="font-mono text-foreground">{{ input.folderOptions.length }}</span>
            </div>
          </div>
        </aside>
      </div>

      <Alert v-if="hasWrites" variant="destructive" class="mx-6 mb-5 w-auto">
        <CircleAlert class="size-4" />
        <AlertTitle>Найдена запись во внешние данные</AlertTitle>
        <AlertDescription>
          Для такого фрагмента нужен output contract. Автоматический экспорт пока недоступен.
        </AlertDescription>
      </Alert>

      <DialogFooter class="border-t bg-muted/20 px-6 py-4">
        <Button type="button" variant="ghost" @click="emit('cancel')">
          Отмена
        </Button>
        <Button type="button" :disabled="!formIsValid || hasWrites" @click="submit">
          Создать и заменить
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
