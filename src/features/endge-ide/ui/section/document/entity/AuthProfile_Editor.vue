<script setup lang="ts">
import type { RAuthProfileEditor } from '@/features/endge-ide/domain/entities/RAuthProfileEditor'
import type {
  AuthProfileAdapterId,
  AuthProfileSchema,
  AuthProfileTestResult,
  AuthSessionStorage,
} from '@endge/core'

import { Endge } from '@endge/core'
import { Loader2, Play, Save } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/kernel/endge-ide'
import { getConfiguratorOidcPopupCallbackURL } from '@/features/endge-ide/model/auth/oidc-browser-url'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'

const props = defineProps<{
  tabContext?: { editor?: RAuthProfileEditor }
}>()

const editor = computed<RAuthProfileEditor | null>(() => props.tabContext?.editor ?? null)
const adapterEditors = EndgeIDE.authProfileEditors.list()
const testLoading = ref(false)

const adapterModel = computed<AuthProfileAdapterId>({
  get: () => editor.value?.adapterId ?? 'bearer',
  set: (value) => {
    if (editor.value)
      editor.value.adapterId = value
  },
})

const storageModel = computed<AuthSessionStorage>({
  get: () => editor.value?.sessionStorage ?? 'memory',
  set: (value) => {
    if (editor.value)
      editor.value.sessionStorage = value
  },
})

const supportsSession = computed(() => adapterModel.value === 'oidc'
  || adapterModel.value === 'oauth2-client-credentials'
  || adapterModel.value === 'oauth2-password')

const selectedAdapterEditor = computed(() => EndgeIDE.authProfileEditors.get(adapterModel.value))

const configModel = computed<Record<string, unknown>>({
  get: () => parseObject(editor.value?.configText ?? '{}'),
  set: (value) => {
    if (editor.value)
      editor.value.configText = stringify(value)
  },
})

const credentialsModel = computed<Record<string, unknown>>({
  get: () => parseObject(editor.value?.credentialsText ?? '{}'),
  set: (value) => {
    if (editor.value)
      editor.value.credentialsText = stringify(value)
  },
})

watch(
  () => editor.value?.adapterId,
  (adapterId, previousAdapterId) => {
    if (!adapterId || !editor.value)
      return
    const registration = EndgeIDE.authProfileEditors.get(adapterId)
    if (!registration?.defaults)
      return

    const configDefaults = structuredClone(registration.defaults.config ?? {})
    const credentialDefaults = structuredClone(registration.defaults.credentials ?? {})
    if (previousAdapterId == null) {
      configModel.value = mergeMissing(configModel.value, configDefaults)
      credentialsModel.value = mergeMissing(credentialsModel.value, credentialDefaults)
    }
    else if (previousAdapterId !== adapterId) {
      configModel.value = configDefaults
      credentialsModel.value = credentialDefaults
    }
    if (previousAdapterId && previousAdapterId !== adapterId && supportsSession.value) {
      storageModel.value = 'memory'
      editor.value.persistRefreshToken = false
    }
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
    const result = profile.adapterId === 'oidc'
      ? await testOidcProfile(profile)
      : await Endge.auth.profiles.test(profile)

    if (profile.adapterId === 'basic' || profile.adapterId === 'bearer') {
      toast.success('Заголовок сформирован', {
        description: 'Credentials разрешены, но внешний сервис этим тестом не проверялся.',
      })
    }
    else {
      toast.success('Авторизация выполнена', {
        description: result.context.subject
          ? `Пользователь: ${result.context.subject}`
          : 'Профиль успешно проверен в изолированной сессии.',
      })
    }
  }
  catch (error: any) {
    const message = normalizeErrorMessage(error)
    console.error(`[AuthProfile_Editor] Ошибка теста авторизации: ${error instanceof Error ? error.message : String(error)}`)
    toast.error('Ошибка авторизации', { description: message })
  }
  finally {
    testLoading.value = false
  }
}

async function testOidcProfile(profile: AuthProfileSchema): Promise<AuthProfileTestResult> {
  if (!profile.session)
    throw new Error('OIDC session policy is required')
  const callback = getConfiguratorOidcPopupCallbackURL()
  const source = Endge.auth.createOidcSessionSource(profile, {
    redirectUri: callback,
    popupRedirectUri: callback,
    postLogoutRedirectUri: new URL(callback).origin,
    flow: 'popup',
  })
  const token = await source.loginPopup()
  const userInfo = await source.loadUserInfo()
  const subject = String(userInfo?.sub ?? '').trim()
  return {
    authenticated: Boolean(token.accessToken),
    profileIdentity: profile.identity,
    expiresAt: token.accessExpiresAt,
    context: { authenticated: true, profileIdentity: profile.identity, ...(subject ? { subject } : {}) },
    userInfo,
  }
}

function setActive(value: unknown): void {
  if (editor.value)
    editor.value.active = value === true
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
    credentials: parseStringObject(source.credentialsText),
    ...(supportsSession.value ? { session: { storage: source.sessionStorage, persistRefreshToken: source.persistRefreshToken } } : {}),
    active: source.active !== false,
    meta: { test: true },
  }
}

function parseStringObject(value: string): Record<string, string> {
  const raw = parseObject(value)
  const out: Record<string, string> = {}
  for (const [key, v] of Object.entries(raw))
    out[key] = v == null ? '' : String(v)
  return out
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
  <div v-if="!editor" class="p-4 text-sm text-muted-foreground">
    Нет редактора
  </div>
  <SourceDocumentEditorShell
    v-else
    :document-id="editor.id"
    :identity="editor.identity"
  >
    <template #center>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                aria-label="Тестовый запуск авторизации"
                :disabled="testLoading || EndgeIDE.busy.value"
                @click="testAuthProfile"
              >
                <Loader2 v-if="testLoading" class="size-4 animate-spin" />
                <Play v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Тестовый запуск авторизации</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                aria-label="Сохранить"
                :disabled="EndgeIDE.busy.value"
                @click="save"
              >
                <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
                <Save v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Сохранить</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <ScrollArea class="min-h-0 flex-1">
      <div class="grid min-h-full w-full gap-4 bg-muted/20 p-5 xl:grid-cols-[minmax(0,1fr)_380px]">
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

            <div v-if="supportsSession" class="min-w-0 space-y-1">
              <Label class="text-xs text-muted-foreground">Хранение</Label>
              <Select v-model="storageModel">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="localStorage">localStorage</SelectItem>
                  <SelectItem value="sessionStorage">sessionStorage</SelectItem>
                  <SelectItem value="memory">memory</SelectItem>
                </SelectContent>
              </Select>
              <p class="text-xs text-muted-foreground">memory — до перезагрузки, sessionStorage — до закрытия вкладки, localStorage — между запусками.</p>
            </div>
          </div>

          <div v-if="supportsSession" class="space-y-2 rounded-md border bg-muted/30 p-3">
            <div class="flex items-center justify-between gap-4"><Label class="text-sm">Сохранять refresh token</Label><Switch v-model:checked="editor.persistRefreshToken" /></div>
            <p class="text-xs text-destructive">Включайте только осознанно: refresh token будет доступен JavaScript-коду и browser storage.</p>
          </div>

          <component
            :is="selectedAdapterEditor.editor"
            v-if="selectedAdapterEditor?.editor"
            v-model:config="configModel"
            v-model:credentials="credentialsModel"
          />
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
                @update:checked="setActive"
              />
              <Label class="text-sm">Активен</Label>
            </div>
          </div>
        </Card>
      </div>
    </ScrollArea>
  </SourceDocumentEditorShell>
</template>
