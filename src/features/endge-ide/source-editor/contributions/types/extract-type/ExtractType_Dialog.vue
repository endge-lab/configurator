<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { ExtractTypeDialogInput, ExtractTypeDialogResult } from './extract-type.types'

import { Braces, FolderTree } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const props = defineProps<{
  open: boolean
  input: ExtractTypeDialogInput
}>()
const emit = defineEmits<{
  'submit': [result: ExtractTypeDialogResult]
  'cancel': []
  'update:open': [open: boolean]
}>()

const ROOT_FOLDER_VALUE = '__root__'

const names = ref<Record<string, string>>({})
const folder = ref(ROOT_FOLDER_VALUE)
const activeType = ref('')
const openModel = computed({
  get: () => props.open,
  set: value => emit('update:open', value),
})
const valid = computed(() => props.input.items.every(item => Boolean(names.value[item.declaration.identity]?.trim())))

watch(
  () => [props.open, props.input] as const,
  ([open]) => {
    if (!open) {
      return
    }
    names.value = Object.fromEntries(props.input.items.map(item => [item.declaration.identity, item.declaration.identity]))
    activeType.value = props.input.rootIdentity
    folder.value = ROOT_FOLDER_VALUE
  },
  { immediate: true },
)

function submit(): void {
  if (!valid.value) {
    return
  }
  emit('submit', {
    types: props.input.items.map(item => ({
      identity: item.declaration.identity,
      name: names.value[item.declaration.identity]!.trim(),
    })),
    folderId: folder.value === ROOT_FOLDER_VALUE ? null : folder.value,
  })
}
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent class="overflow-hidden p-0 sm:max-w-[900px]">
      <DialogHeader class="border-b bg-muted/30 px-6 py-5">
        <div class="flex items-start gap-3 pr-8">
          <div class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border bg-background shadow-sm">
            <Braces class="size-4 text-blue-500" />
          </div>
          <div class="min-w-0 space-y-1">
            <DialogTitle>Выделить в RType</DialogTitle>
            <p class="text-sm text-muted-foreground">
              Будет создано RType-документов: {{ input.items.length }}. Локальные объявления будут удалены из компонента.
            </p>
          </div>
        </div>
      </DialogHeader>

      <div class="space-y-5 px-6 py-5">
        <div class="space-y-2">
          <Label class="flex items-center gap-2">
            <FolderTree class="size-4 text-amber-500" />
            Папка типов
          </Label>
          <Select v-model="folder">
            <SelectTrigger><SelectValue placeholder="Корень типов" /></SelectTrigger>
            <SelectContent>
              <SelectItem :value="ROOT_FOLDER_VALUE">
                Корень типов
              </SelectItem>
              <SelectItem v-for="option in input.folderOptions" :key="option.id" :value="option.id">
                {{ option.path }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs v-model="activeType" class="min-w-0">
          <div class="overflow-x-auto border-b">
            <TabsList class="h-auto w-max justify-start rounded-none bg-transparent p-0">
              <TabsTrigger
                v-for="item in input.items"
                :key="item.declaration.identity"
                :value="item.declaration.identity"
                class="rounded-none border-b-2 border-transparent px-4 py-2.5 font-mono data-[state=active]:border-primary"
              >
                {{ item.declaration.identity }}
                <span v-if="item.declaration.identity === input.rootIdentity" class="ml-1 font-sans text-xs text-muted-foreground">
                  root
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            v-for="item in input.items"
            :key="item.declaration.identity"
            :value="item.declaration.identity"
            class="mt-4 grid gap-4 md:grid-cols-2"
          >
            <div class="space-y-4">
              <div class="space-y-2">
                <Label :for="`extract-type-identity-${item.declaration.identity}`">Identity</Label>
                <Input
                  :id="`extract-type-identity-${item.declaration.identity}`"
                  :model-value="item.declaration.identity"
                  class="font-mono"
                  disabled
                />
              </div>
              <div class="space-y-2">
                <Label :for="`extract-type-name-${item.declaration.identity}`">Название</Label>
                <Input
                  :id="`extract-type-name-${item.declaration.identity}`"
                  v-model="names[item.declaration.identity]"
                />
              </div>
              <div class="min-w-0 overflow-hidden rounded-lg border bg-muted/20">
                <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                  Original TypeScript
                </div>
                <pre class="max-h-[190px] overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-5">{{ item.declaration.source }}</pre>
              </div>
            </div>

            <div class="min-w-0 overflow-hidden rounded-lg border bg-muted/20">
              <div class="border-b px-3 py-2.5 text-sm font-medium">
                Generated Type Source
              </div>
              <pre class="max-h-[330px] overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-5">{{ item.sourcePreview }}</pre>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <DialogFooter class="border-t bg-muted/20 px-6 py-4">
        <Button type="button" variant="ghost" @click="emit('cancel')">
          Отмена
        </Button>
        <Button type="button" :disabled="!valid" @click="submit">
          Создать {{ input.items.length }} RType
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
