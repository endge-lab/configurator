<script setup lang="ts">
import type { RSettings_Editor } from '@/features/endge-admin/domain/entities/RSettings_Editor'
import type { SettingsVarSchema } from '@endge/core'

import { Loader2, Plus, Trash2 } from 'lucide-vue-next'
import { computed, ref, watchEffect } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'

const props = defineProps<{
  tabContext?: { editor?: RSettings_Editor }
}>()

const editor = computed(() => props.tabContext?.editor)
const tabKey = ref('main')
const varsModel = ref<SettingsVarSchema[]>([])

watchEffect(() => {
  varsModel.value = Array.isArray(editor.value?.vars) ? editor.value!.vars : []
})

function ensureVars(): void {
  const e = editor.value
  if (!e)
    return
  if (!Array.isArray(e.vars))
    e.vars = []
  varsModel.value = e.vars
}

function addVar(): void {
  ensureVars()
  varsModel.value.push({
    name: '',
    defaultValue: '',
    currentValue: '',
    secret: 'pure',
  })
  if (editor.value)
    editor.value.vars = varsModel.value
}

function removeVar(index: number): void {
  varsModel.value.splice(index, 1)
  if (editor.value)
    editor.value.vars = varsModel.value
}

function ensureAuth(): void {
  const e = editor.value
  if (e && !e.auth) {
    e.auth = {
      provider: 'keycloak_form',
      KeycloakBaseUrl: '',
      storageKey: 'api_token_data',
      clientId: '',
      scope: 'openid',
      refreshSkewMs: 300000,
    }
  }
}

function ensureSse(): void {
  const e = editor.value
  if (e && !e.sse) e.sse = { url: '', authMode: 'inherit' }
}

function ensureVocabs(): void {
  const e = editor.value
  if (e && !Array.isArray(e.vocabs)) e.vocabs = []
}

function addVocab(): void {
  ensureVocabs()
  editor.value?.vocabs?.push({ identity: '', baseApiUrl: '', collections: [] })
}

function removeVocab(index: number): void {
  editor.value?.vocabs?.splice(index, 1)
}

function ensureCollections(voc: { collections?: { name: string }[] }): void {
  if (voc && !Array.isArray(voc.collections)) voc.collections = []
}

function addCollection(voc: { collections?: { name: string }[] }): void {
  ensureCollections(voc)
  voc.collections!.push({ name: '' })
}

function removeCollection(voc: { collections?: { name: string }[] }, colIdx: number): void {
  voc.collections?.splice(colIdx, 1)
}

async function save(): Promise<void> {
  await EndgeAdmin.tabs.save()
}
</script>

<template>
  <div v-if="!editor" class="flex items-center justify-center h-full text-sm text-muted-foreground">
    Профиль не выбран
  </div>
  <div v-else class="flex flex-col h-full">
    <div class="border-b p-3 flex items-center justify-between shrink-0">
      <h2 class="text-lg font-semibold truncate">{{ editor.displayName || editor.identity }}</h2>
      <Button size="sm" :disabled="EndgeAdmin.busy.value" @click="save">
        <Loader2 v-if="EndgeAdmin.busy.value" class="size-4 animate-spin mr-1" />
        {{ EndgeAdmin.busy.value ? 'Сохранение…' : 'Сохранить' }}
      </Button>
    </div>
    <ScrollArea class="flex-1">
      <div class="p-4">
        <Tabs v-model="tabKey" class="w-full">
          <TabsList class="grid w-full grid-cols-4">
            <TabsTrigger value="main">Основное</TabsTrigger>
            <TabsTrigger value="vars">Переменные</TabsTrigger>
            <TabsTrigger value="auth">Авторизация</TabsTrigger>
            <TabsTrigger value="vocabs">Словари</TabsTrigger>
          </TabsList>

          <TabsContent value="main" class="space-y-4 mt-4">
            <div class="space-y-2">
              <Label>Название профиля</Label>
              <Input v-model="editor.displayName" placeholder="displayName" />
            </div>
            <div class="space-y-2">
              <Label>Проект (identity)</Label>
              <Input v-model="editor.project" placeholder="null или id проекта" />
            </div>
            <div class="space-y-2">
              <Label>SSE</Label>
              <Button v-if="!editor.sse" size="sm" variant="outline" @click="ensureSse">Добавить SSE</Button>
              <template v-else>
                <Input v-model="editor.sse.url" placeholder="https://..." />
              </template>
            </div>
          </TabsContent>

          <TabsContent value="vars" class="space-y-4 mt-4">
            <div class="flex items-center justify-between">
              <Label>Глобальные переменные</Label>
              <Button size="sm" variant="outline" @click="addVar">
                <Plus class="size-4 mr-1" /> Добавить
              </Button>
            </div>
            <div v-if="!varsModel.length" class="text-sm text-muted-foreground py-2">
              Нет переменных
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="(v, idx) in varsModel"
                :key="idx"
                class="flex flex-wrap items-center gap-2 rounded border p-2"
              >
                <Input
                  v-model="v.name"
                  placeholder="Имя"
                  class="w-40"
                />
                <Input
                  v-model="v.defaultValue"
                  placeholder="Значение по умолчанию"
                  class="flex-1 min-w-32"
                />
                <Input
                  v-model="v.currentValue"
                  placeholder="Текущее значение"
                  class="flex-1 min-w-32"
                />
                <Button size="icon" variant="ghost" class="shrink-0" @click="removeVar(idx)">
                  <Trash2 class="size-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="auth" class="space-y-4 mt-4">
            <Button size="sm" variant="outline" @click="ensureAuth">Включить авторизацию</Button>
            <template v-if="editor.auth">
              <div class="space-y-2">
                <Label>Keycloak Base URL</Label>
                <Input v-model="editor.auth.KeycloakBaseUrl" placeholder="https://..." />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div class="space-y-2">
                  <Label>storageKey</Label>
                  <Input v-model="editor.auth.storageKey" />
                </div>
                <div class="space-y-2">
                  <Label>clientId</Label>
                  <Input v-model="editor.auth.clientId" />
                </div>
              </div>
              <div class="space-y-2">
                <Label>scope</Label>
                <Input v-model="editor.auth.scope" />
              </div>
              <div class="space-y-2">
                <Label>refreshSkewMs</Label>
                <Input v-model.number="editor.auth.refreshSkewMs" type="number" />
              </div>
              <template v-if="editor.auth.provider === 'keycloak_manual'">
                <div class="space-y-2">
                  <Label>login</Label>
                  <Input v-model="(editor.auth as any).login" />
                </div>
                <div class="space-y-2">
                  <Label>password</Label>
                  <Input v-model="(editor.auth as any).password" type="password" />
                </div>
              </template>
            </template>
          </TabsContent>

          <TabsContent value="vocabs" class="space-y-4 mt-4">
            <div class="flex items-center justify-between">
              <Label>Внешние словари (vocabs)</Label>
              <Button size="sm" variant="outline" @click="addVocab">
                <Plus class="size-4 mr-1" /> Добавить источник
              </Button>
            </div>
            <div v-if="!editor.vocabs?.length" class="text-sm text-muted-foreground py-2">
              Нет источников
            </div>
            <div v-else class="space-y-4">
              <div
                v-for="(voc, idx) in editor.vocabs"
                :key="idx"
                class="rounded border p-3 space-y-3"
              >
                <div class="flex items-center gap-2">
                  <div class="space-y-1 flex-1 min-w-0">
                    <Label class="text-xs">Identity</Label>
                    <Input v-model="voc.identity" placeholder="identity набора словарей" class="w-full" />
                  </div>
                  <Button size="icon" variant="ghost" class="shrink-0 mt-6" @click="removeVocab(idx)">
                    <Trash2 class="size-4" />
                  </Button>
                </div>
                <div class="space-y-1">
                  <Label class="text-xs">Base API URL</Label>
                  <Input v-model="voc.baseApiUrl" placeholder="https://api.example.com" />
                </div>
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <Label class="text-xs">Коллекции (slug во внешнем API)</Label>
                    <Button size="sm" variant="ghost" class="h-7 text-xs" @click="addCollection(voc)">
                      <Plus class="size-3 mr-1" /> Добавить
                    </Button>
                  </div>
                  <div v-if="!voc.collections?.length" class="text-sm text-muted-foreground py-1">
                    Нет коллекций
                  </div>
                  <div v-else class="space-y-2">
                    <div
                      v-for="(col, colIdx) in voc.collections"
                      :key="colIdx"
                      class="flex items-center gap-2 rounded border bg-muted/30 px-2 py-1.5"
                    >
                      <Input
                        v-model="col.name"
                        placeholder="name (например airlines)"
                        class="flex-1 min-w-0 h-8 text-sm"
                      />
                      <Button size="icon" variant="ghost" class="size-7 shrink-0" @click="removeCollection(voc, colIdx)">
                        <Trash2 class="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  </div>
</template>
