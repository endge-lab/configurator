<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text, style/max-statements-per-line */
import type {
  ExtractComponentDialogDependency,
  ExtractComponentDialogInput,
  ExtractComponentDialogResult,
} from './extract-component.types'

import { ArrowRight, Box, Braces, CircleAlert } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'

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
const formIsValid = computed(() => Boolean(
  name.value.trim()
  && identity.value.trim()
  && tagIsValid.value
  && dependencies.value.every(dependency => dependency.type.trim()),
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
  },
  { immediate: true },
)

function submit(): void {
  if (!formIsValid.value || hasWrites.value) { return }

  emit('submit', {
    name: name.value.trim(),
    identity: identity.value.trim(),
    tag: normalizedTag.value || null,
    dependencies: dependencies.value.map(dependency => ({
      ...dependency,
      type: dependency.type.trim() || 'unknown',
      paths: [...dependency.paths],
    })),
  })
}
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent class="overflow-hidden p-0 sm:max-w-[720px]">
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

      <div class="grid min-h-0 gap-5 px-6 py-5 md:grid-cols-[minmax(0,1fr)_260px]">
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

        <aside class="min-w-0 rounded-lg border bg-muted/20">
          <div class="flex items-center justify-between border-b px-3 py-2.5">
            <div class="flex items-center gap-2 text-sm font-medium">
              <Braces class="size-4 text-sky-500" />
              Входные данные
            </div>
            <Badge variant="outline" class="font-mono text-[10px]">
              {{ dependencies.length }} props
            </Badge>
          </div>

          <ScrollArea class="h-[238px]">
            <div v-if="dependencies.length" class="divide-y">
              <div
                v-for="dependency in dependencies"
                :key="dependency.propName"
                class="space-y-2 px-3 py-3"
              >
                <div class="flex items-center gap-1.5 font-mono text-xs">
                  <span class="text-muted-foreground">{{ dependency.sourceExpression }}</span>
                  <ArrowRight class="size-3 text-muted-foreground/60" />
                  <span class="font-semibold text-foreground">{{ dependency.propName }}</span>
                </div>
                <Input
                  v-model="dependency.type"
                  class="h-8 font-mono text-xs"
                  aria-label="Тип prop"
                  spellcheck="false"
                />
                <div v-if="dependency.paths.length" class="flex flex-wrap gap-1">
                  <code
                    v-for="path in dependency.paths"
                    :key="path"
                    class="max-w-full truncate rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border"
                  >
                    {{ path || 'value' }}
                  </code>
                </div>
              </div>
            </div>
            <div v-else class="flex h-[180px] items-center justify-center px-6 text-center text-xs text-muted-foreground">
              Внешние данные не найдены. Компонент будет создан без props.
            </div>
          </ScrollArea>
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
