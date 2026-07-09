<script setup lang="ts">
import type { RVocabsEditor } from '@/features/endge-ide/domain/entities/RVocabsEditor'

import { Endge } from '@endge/core'
import { useSubscribableRefAuto } from '@endge/utils'
import { Database, Loader2 } from 'lucide-vue-next'
import { computed } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import SaveDocumentButton from '@/features/endge-ide/ui/components/SaveDocumentButton.vue'

const props = defineProps<{
  tabContext?: { editor?: RVocabsEditor }
}>()

const editor = computed<RVocabsEditor | null>(() => props.tabContext?.editor ?? null)
const vocabsRef = useSubscribableRefAuto(Endge.vocabs)

const modeModel = computed<'external_payload' | 'internal'>({
  get: () => editor.value?.mode ?? 'internal',
  set: (value) => {
    if (!editor.value)
      return
    editor.value.mode = value === 'external_payload' ? 'external_payload' : 'internal'
  },
})

const authModeModel = computed<'inherit' | 'profile' | 'manual' | 'none'>({
  get: () => editor.value?.authMode ?? 'inherit',
  set: (value) => {
    if (!editor.value)
      return
    editor.value.authMode = value
    if (value !== 'profile')
      editor.value.authProfileIdentity = ''
  },
})

const canLoadVocab = computed(() => editor.value?.mode === 'external_payload' && Number(editor.value?.id) > 0)
const isVocabLoading = computed(() => vocabsRef.value.loading === true)

async function loadVocab(): Promise<void> {
  if (!canLoadVocab.value || !editor.value?.id)
    return

  // Временно отключено для работы админки без авторизации
  // if (!Endge.auth.isAuthenticated) {
  //   toast.error('Не удалось получить доступ к справочнику', {
  //     description: 'Проверьте авторизацию и настройки словаря',
  //   })
  //   return
  // }

  try {
    const docs = await Endge.vocabs.loadVocab(editor.value.id)
    toast.success('Словарь загружен и добавлен в локальное хранилище')
    EndgeIDE.modals.openVocabJsonPreview({
      title: editor.value.displayName || editor.value.identity || 'Словарь',
      data: docs,
    })
  }
  catch (error: any) {
    toast.error('Не удалось получить доступ к справочнику', {
      description: String(error?.message ?? 'Ошибка загрузки словаря'),
    })
  }
}

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <div class="p-3 border-b flex items-center justify-between gap-3 shrink-0">
      <div class="text-lg font-semibold truncate">
        Словарь - {{ editor?.displayName ?? '-' }}
      </div>
      <div class="flex items-center gap-2">
        <TooltipProvider :delay-duration="300">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 shrink-0"
                :disabled="!canLoadVocab || isVocabLoading"
                @click="loadVocab"
              >
                <Loader2 v-if="isVocabLoading" class="size-4 animate-spin" />
                <Database v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Полная загрузка словаря</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <SaveDocumentButton :loading="EndgeIDE.busy.value" @click="save" />
      </div>
    </div>

    <ScrollArea class="flex-1 px-4 py-3">
      <div class="max-w-3xl space-y-6">
        <Card class="p-4 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">identity</Label>
              <Input v-model="editor!.identity" placeholder="base-airlines" />
            </div>
            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">Название</Label>
              <Input v-model="editor!.displayName" placeholder="Авиакомпании" />
            </div>
          </div>

          <div class="space-y-1">
            <Label class="text-xs text-muted-foreground">Описание</Label>
            <Textarea v-model="editor!.description" :rows="2" placeholder="Краткое описание словаря" />
          </div>

          <div class="space-y-1">
            <Label class="text-xs text-muted-foreground">Режим</Label>
            <Select v-model="modeModel">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="external_payload">Внешний Payload</SelectItem>
                <SelectItem value="internal">Внутренний</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div v-if="editor?.mode === 'external_payload'" class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">Base API URL</Label>
              <Input v-model="editor!.baseApiUrl" placeholder="https://api.example.com" />
            </div>
            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">Collection slug</Label>
              <Input v-model="editor!.collectionSlug" placeholder="airlines" />
            </div>
          </div>

          <div v-if="editor?.mode === 'external_payload'" class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">Авторизация</Label>
              <Select v-model="authModeModel">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">inherit</SelectItem>
                  <SelectItem value="profile">profile</SelectItem>
                  <SelectItem value="manual">manual</SelectItem>
                  <SelectItem value="none">none</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div v-if="editor.authMode === 'profile'" class="space-y-1">
              <Label class="text-xs text-muted-foreground">Auth profile identity</Label>
              <Input v-model="editor.authProfileIdentity" placeholder="payload-cms-auth" />
            </div>
          </div>
        </Card>
      </div>
    </ScrollArea>
  </div>
</template>
