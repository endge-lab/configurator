<script setup lang="ts">
import type { RAuthProfileEditor } from '@/features/endge-ide/domain/entities/RAuthProfileEditor'
import type {
  AuthProfileAdapterId,
  AuthProfilePersist,
  AuthProfileSchema,
} from '@endge/core'

import { Endge } from '@endge/core'
import { KeyRound, Loader2, Play } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  getAuthProfileAdapterEditor,
  getAuthProfileAdapterEditors,
} from '@/features/endge-ide/model/auth-profile/auth-profile-adapter-ui-registry.ts'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import SaveDocumentButton from '@/features/endge-ide/ui/components/SaveDocumentButton.vue'

const props = defineProps<{
  tabContext?: { editor?: RAuthProfileEditor }
}>()

const editor = computed<RAuthProfileEditor | null>(() => props.tabContext?.editor ?? null)
const adapterEditors = getAuthProfileAdapterEditors()
const testLoading = ref(false)

const adapterModel = computed<AuthProfileAdapterId>({
  get: () => editor.value?.adapterId ?? 'manual_token',
  set: (value) => {
    if (editor.value)
      editor.value.adapterId = value
  },
})

const persistModel = computed<AuthProfilePersist>({
  get: () => editor.value?.persist ?? 'localStorage',
  set: (value) => {
    if (editor.value)
      editor.value.persist = value
  },
})

const selectedAdapterEditor = computed(() => getAuthProfileAdapterEditor(adapterModel.value))

const configModel = computed<Record<string, unknown>>({
  get: () => parseObject(editor.value?.configText ?? '{}'),
  set: (value) => {
    if (editor.value)
      editor.value.configText = stringify(value)
  },
})

const credentialRefsModel = computed<Record<string, unknown>>({
  get: () => parseObject(editor.value?.credentialRefsText ?? '{}'),
  set: (value) => {
    if (editor.value)
      editor.value.credentialRefsText = stringify(value)
  },
})

watch(
  () => editor.value?.adapterId,
  (adapterId) => {
    if (!adapterId || !editor.value)
      return
    const registration = getAuthProfileAdapterEditor(adapterId)
    if (!registration?.defaults)
      return

    const configDefaults = registration.defaults.config ?? {}
    const credentialDefaults = registration.defaults.credentialRefs ?? {}
    configModel.value = mergeMissing(configModel.value, configDefaults)
    credentialRefsModel.value = mergeMissing(credentialRefsModel.value, credentialDefaults)
  },
  { immediate: true },
)

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}

async function testAuthProfile(): Promise<void> {
  const current = editor.value
  if (!current) {
    toast.error('Нет редактора профиля авторизации')
    return
  }

  testLoading.value = true
  try {
    const profile = buildProfileSchema(current)
    const session = await Endge.auth.profiles.test(profile)
    const token = String(session.accessToken ?? '')
    const storageKey = getStorageKey(profile)

    console.info('[AuthProfile_Editor] Тест авторизации выполнен', {
      identity: profile.identity,
      adapterId: profile.adapterId,
      persist: profile.persist,
      storageKey,
      hasAccessToken: Boolean(token),
      tokenPreview: maskToken(token),
      tokenLength: token.length,
      expiresAt: session.expiresAt ? new Date(session.expiresAt).toISOString() : null,
      headerNames: Object.keys(session.headers ?? {}),
      stored: profile.persist === 'memory'
        ? 'memory'
        : Boolean(window[profile.persist === 'sessionStorage' ? 'sessionStorage' : 'localStorage'].getItem(storageKey)),
    })

    toast.success('Авторизация выполнена', {
      description: token
        ? `Токен применен. Подробности выведены в консоль.`
        : 'Профиль выполнился без access token.',
    })
  }
  catch (error: any) {
    const message = normalizeErrorMessage(error)
    console.error('[AuthProfile_Editor] Ошибка теста авторизации:', error)
    toast.error('Ошибка авторизации', { description: message })
  }
  finally {
    testLoading.value = false
  }
}

function parseObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  }
  catch {
    return {}
  }
}

function stringify(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2)
}

function mergeMissing(
  current: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...current }
  for (const [key, value] of Object.entries(defaults)) {
    if (next[key] == null || next[key] === '')
      next[key] = value
  }
  return next
}

function buildProfileSchema(source: RAuthProfileEditor): AuthProfileSchema {
  return {
    id: source.id ?? source.identity ?? '__auth_profile_draft__',
    identity: source.identity || '__auth_profile_draft__',
    name: source.displayName || source.identity || 'Auth profile draft',
    displayName: source.displayName || source.identity || 'Auth profile draft',
    description: source.description || null,
    adapterId: source.adapterId,
    config: parseObject(source.configText),
    credentialRefs: parseStringObject(source.credentialRefsText),
    persist: source.persist,
    active: source.active !== false,
    meta: { test: true },
  }
}

function parseStringObject(value: string): Record<string, string | undefined> {
  const raw = parseObject(value)
  const out: Record<string, string | undefined> = {}
  for (const [key, v] of Object.entries(raw))
    out[key] = v == null ? undefined : String(v)
  return out
}

function getStorageKey(profile: AuthProfileSchema): string {
  const raw = profile.config?.storageKey
  const value = raw == null ? '' : String(raw).trim()
  if (!value)
    return `endge.auth.${profile.identity}`
  return String(Endge.workspace.variables.resolve(value) ?? value).trim() || `endge.auth.${profile.identity}`
}

function maskToken(token: string): string {
  if (!token)
    return ''
  if (token.length <= 12)
    return `${token.slice(0, 3)}...${token.slice(-3)}`
  return `${token.slice(0, 6)}...${token.slice(-6)}`
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message)
    return error.message
  if (error && typeof error === 'object' && 'message' in error)
    return String((error as { message?: unknown }).message)
  return String(error)
}
</script>

<template>
  <div class="flex h-full min-h-0 w-full flex-col overflow-hidden bg-muted/20">
    <div class="flex shrink-0 items-center justify-between gap-3 border-b bg-editor-surface px-5 py-3">
      <div class="flex items-center gap-2 min-w-0">
        <KeyRound class="size-5 text-sky-500 shrink-0" />
        <div class="text-lg font-semibold truncate">
          Профиль авторизации - {{ editor?.displayName ?? '-' }}
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <SaveDocumentButton :loading="EndgeIDE.busy.value" @click="save" />
        <Button
          size="icon"
          variant="outline"
          aria-label="Тестовый запуск авторизации"
          :disabled="testLoading || EndgeIDE.busy.value"
          @click="testAuthProfile"
        >
          <Loader2 v-if="testLoading" class="size-4 animate-spin" />
          <Play v-else class="size-4" />
        </Button>
      </div>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div v-if="editor" class="grid min-h-full w-full gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card class="min-w-0 space-y-5 p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-semibold">
                Настройки адаптера
              </div>
              <div class="truncate text-xs text-muted-foreground">
                {{ selectedAdapterEditor?.label ?? adapterModel }}
              </div>
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <div class="min-w-0 space-y-1">
              <Label class="text-xs text-muted-foreground">Адаптер</Label>
              <Select v-model="adapterModel">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="adapter in adapterEditors"
                    :key="adapter.id"
                    :value="adapter.id"
                  >
                    {{ adapter.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="min-w-0 space-y-1">
              <Label class="text-xs text-muted-foreground">Хранение</Label>
              <Select v-model="persistModel">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="localStorage">localStorage</SelectItem>
                  <SelectItem value="sessionStorage">sessionStorage</SelectItem>
                  <SelectItem value="memory">memory</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <component
            :is="selectedAdapterEditor.editor"
            v-if="selectedAdapterEditor?.editor"
            v-model:config="configModel"
            v-model:credential-refs="credentialRefsModel"
          />
          <div v-else class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Для этого адаптера нет визуального редактора.
          </div>
        </Card>

        <Card class="min-w-0 space-y-4 p-4 xl:sticky xl:top-5 xl:self-start">
          <div>
            <div class="text-sm font-semibold">
              Документ
            </div>
            <div class="text-xs text-muted-foreground">
              Служебные свойства профиля
            </div>
          </div>

          <div class="space-y-4">
            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">identity</Label>
              <Input v-model="editor.identity" autocomplete="off" />
            </div>

            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">Название</Label>
              <Input v-model="editor.displayName" autocomplete="off" />
            </div>

            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">Описание</Label>
              <Textarea v-model="editor.description" :rows="5" />
            </div>

            <div class="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <Checkbox
                :checked="editor.active"
                @update:checked="value => { editor.active = value === true }"
              />
              <Label class="text-sm">Активен</Label>
            </div>
          </div>
        </Card>
      </div>
    </ScrollArea>
  </div>
</template>
