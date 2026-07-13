<script setup lang="ts">
import type {
  EndgeWorkspaceLocale,
  EndgeWorkspaceSSEConfig,
  EndgeWorkspaceVar,
} from '@endge/core'

import { Endge } from '@endge/core'
import { useDomainStore } from '@endge/vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import { computed, onScopeDispose, ref, watchEffect } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import SaveDocumentButton from '@/features/endge-ide/ui/components/SaveDocumentButton.vue'

type LocaleDirection = 'ltr' | 'rtl'
type AuthProfileOption = {
  identity: string
  label: string
  adapterId: string
}

const NO_AUTH_PROFILE = '__none__'
const SFC_ADAPTER_LABEL = 'SFC-адаптер по умолчанию'
const SFC_ADAPTER_DESCRIPTION = 'Список доступных идентификаторов задаётся в текущем Workspace.'

const domainStore = useDomainStore()
const workspaceVersion = ref(0)
const defaultAuthProfileIdentity = ref(NO_AUTH_PROFILE)
const defaultSfcAdapterId = ref('shadcn-vue')
const defaultLocale = ref('')
const fallbackLocale = ref('')
const locales = ref<EndgeWorkspaceLocale[]>([])
const activeTab = ref<'general' | 'auth' | 'localization'>('general')
const sseEndpoint = ref('')
const sseDraft = ref<EndgeWorkspaceSSEConfig | undefined>()
const envVars = ref<EndgeWorkspaceVar[]>([])

const offWorkspace = Endge.workspace.subscribe(() => {
  workspaceVersion.value += 1
})
onScopeDispose(offWorkspace)

const workspace = computed(() => {
  workspaceVersion.value
  return Endge.workspace.current
})

const activeAuthProfiles = computed<AuthProfileOption[]>(() =>
  (domainStore.authProfiles ?? [])
    .filter((profile: any) => profile?.deletedAt == null && profile?.active !== false)
    .map((profile: any) => ({
      identity: String(profile.identity ?? profile.id ?? '').trim(),
      label: String(profile.displayName ?? profile.name ?? profile.identity ?? profile.id ?? '').trim(),
      adapterId: String(profile.adapterId ?? '').trim(),
    }))
    .filter((profile: AuthProfileOption) => profile.identity.length > 0),
)

const localeOptions = computed(() =>
  locales.value
    .map(locale => ({
      code: String(locale.code ?? '').trim(),
      label: String(locale.displayName || locale.shortLabel || locale.code || '').trim(),
    }))
    .filter(locale => locale.code),
)

const sfcAdapterOptions = computed(() => workspace.value.sfcAdapterIds)

watchEffect(() => {
  const current = workspace.value
  locales.value = current.locales.map(locale => ({ ...locale }))
  envVars.value = current.vars.map(item => ({ ...item }))
  sseDraft.value = current.sse ? { ...current.sse } : undefined
  sseEndpoint.value = current.sse?.url ?? ''
  defaultLocale.value = current.defaultLocale
  fallbackLocale.value = current.fallbackLocale
  defaultAuthProfileIdentity.value = current.defaultAuthProfileIdentity ?? NO_AUTH_PROFILE
  defaultSfcAdapterId.value = current.defaultSfcAdapterId
})

function ensureLocaleSelection(): void {
  const codes = localeOptions.value.map(locale => locale.code)
  if (!codes.length) {
    defaultLocale.value = ''
    fallbackLocale.value = ''
    return
  }
  if (!codes.includes(defaultLocale.value))
    defaultLocale.value = codes[0] ?? ''
  if (!codes.includes(fallbackLocale.value))
    fallbackLocale.value = defaultLocale.value
}

function addLocale(): void {
  const used = new Set(locales.value.map(locale => locale.code))
  let index = locales.value.length + 1
  let code = `locale-${index}`
  while (used.has(code)) {
    index += 1
    code = `locale-${index}`
  }
  locales.value.push({
    code,
    displayName: '',
    shortLabel: code.toUpperCase(),
    direction: 'ltr',
  })
  ensureLocaleSelection()
}

function removeLocale(index: number): void {
  locales.value.splice(index, 1)
  ensureLocaleSelection()
}

function addEnvVar(): void {
  const used = new Set(envVars.value.map(item => item.name.trim()).filter(Boolean))
  let index = envVars.value.length + 1
  let name = `ENV_VAR_${index}`
  while (used.has(name)) {
    index += 1
    name = `ENV_VAR_${index}`
  }
  envVars.value.push({
    name,
    defaultValue: '',
  })
}

function removeEnvVar(index: number): void {
  envVars.value.splice(index, 1)
}

function updateDirection(locale: EndgeWorkspaceLocale, value: string): void {
  locale.direction = value === 'rtl' ? 'rtl' : 'ltr'
}

function normalizeLocales(): EndgeWorkspaceLocale[] {
  const used = new Set<string>()
  const result: EndgeWorkspaceLocale[] = []
  for (const item of locales.value) {
    const code = String(item.code ?? '').trim()
    if (!code || used.has(code))
      continue
    used.add(code)
    const displayName = String(item.displayName ?? '').trim() || code
    const shortLabel = String(item.shortLabel ?? '').trim() || code.toUpperCase()
    const direction: LocaleDirection = item.direction === 'rtl' ? 'rtl' : 'ltr'
    result.push({ code, displayName, shortLabel, direction })
  }
  return result
}

function normalizeEnvVars(input: unknown[]): EndgeWorkspaceVar[] {
  const used = new Set<string>()
  const result: EndgeWorkspaceVar[] = []
  for (const raw of input) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw as Record<string, unknown>
      : {}
    const name = String(source.name ?? source.identity ?? source.key ?? '').trim()
    if (!name || used.has(name))
      continue
    used.add(name)
    result.push({
      name,
      defaultValue: String(source.defaultValue ?? source.currentValue ?? source.value ?? ''),
    })
  }
  return result
}

function normalizeWorkspaceSSE(): EndgeWorkspaceSSEConfig | undefined {
  const url = sseEndpoint.value.trim()
  const draft = sseDraft.value
  if (!url && !draft?.authProfileIdentity && !draft?.manualToken && (!draft?.authMode || draft.authMode === 'inherit'))
    return undefined
  return {
    url,
    authMode: draft?.authMode ?? 'inherit',
    ...(draft?.authProfileIdentity ? { authProfileIdentity: draft.authProfileIdentity } : {}),
    ...(draft?.manualToken ? { manualToken: draft.manualToken } : {}),
  }
}

async function saveWorkspaceSettings(): Promise<void> {
  const nextLocales = normalizeLocales()
  if (!nextLocales.length) {
    toast.error('Добавьте хотя бы одну локаль')
    return
  }

  const defaultCode = nextLocales.some(locale => locale.code === defaultLocale.value)
    ? defaultLocale.value
    : nextLocales[0]!.code
  const fallbackCode = nextLocales.some(locale => locale.code === fallbackLocale.value)
    ? fallbackLocale.value
    : defaultCode

  try {
    await EndgeIDE.runBusy(
      Endge.schema.saveDocument(workspace.value.identity, 'workspace', {
        model: {
          identity: workspace.value.identity,
          displayName: workspace.value.displayName,
          vars: normalizeEnvVars(envVars.value),
          sse: normalizeWorkspaceSSE(),
          locales: nextLocales,
          defaultLocale: defaultCode,
          fallbackLocale: fallbackCode,
          defaultAuthProfileIdentity: defaultAuthProfileIdentity.value === NO_AUTH_PROFILE
            ? null
            : defaultAuthProfileIdentity.value,
          sfcAdapterIds: [...workspace.value.sfcAdapterIds],
          defaultSfcAdapterId: defaultSfcAdapterId.value,
        },
      }),
    )
    Endge.context.setCurrentLocale(defaultCode)

    const selectedAuthProfile = defaultAuthProfileIdentity.value === NO_AUTH_PROFILE
      ? ''
      : defaultAuthProfileIdentity.value

    toast.success('Рабочее пространство сохранено', selectedAuthProfile
      ? { description: `Профиль авторизации: ${selectedAuthProfile}` }
      : undefined)
  }
  catch (error: any) {
    toast.error('Не удалось сохранить рабочее пространство', {
      description: String(error?.message ?? error ?? 'Неизвестная ошибка'),
    })
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-muted/30">
    <div class="flex h-16 shrink-0 items-center justify-between border-b bg-background px-4">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <i class="ti ti-world text-xl text-sky-500" />
          <h2 class="truncate text-lg font-semibold">
            Рабочее пространство
          </h2>
        </div>
      </div>
      <SaveDocumentButton
        :loading="EndgeIDE.busy.value"
        tooltip="Сохранить рабочее пространство"
        aria-label="Сохранить рабочее пространство"
        @click="saveWorkspaceSettings"
      />
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div class="p-4">
        <Tabs v-model="activeTab" class="w-full">
          <TabsList class="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="general">
              Общие
            </TabsTrigger>
            <TabsTrigger value="auth">
              Авторизация
            </TabsTrigger>
            <TabsTrigger value="localization">
              Локализация
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" class="mt-4">
            <Card class="rounded-md">
              <CardHeader class="pb-3">
                <CardTitle class="text-base">
                  Общие
                </CardTitle>
              </CardHeader>
              <CardContent class="space-y-4">
                <div class="space-y-2">
                  <Label>SSE endpoint</Label>
                  <Input
                    v-model="sseEndpoint"
                    class="h-8"
                    placeholder="{ENDPOINT_AODB_SSE}"
                    autocomplete="off"
                  />
                </div>

                <div class="space-y-2">
                  <Label>{{ SFC_ADAPTER_LABEL }}</Label>
                  <Select v-model="defaultSfcAdapterId">
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="Выберите SFC-адаптер" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="adapterId in sfcAdapterOptions"
                        :key="adapterId"
                        :value="adapterId"
                      >
                        {{ adapterId }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p class="text-xs text-muted-foreground">
                    {{ SFC_ADAPTER_DESCRIPTION }}
                  </p>
                </div>

                <div class="space-y-2">
                  <div class="flex items-center justify-between gap-3">
                    <Label>Environment-переменные</Label>
                    <Button size="sm" variant="outline" class="h-8 gap-2" @click="addEnvVar">
                      <Plus class="size-4" />
                      Добавить
                    </Button>
                  </div>

                  <div class="overflow-hidden rounded-md border bg-background">
                    <div class="grid grid-cols-[minmax(12rem,0.8fr)_minmax(16rem,1.2fr)_2.25rem] gap-2 border-b bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground">
                      <span>Переменная</span>
                      <span>Default value</span>
                      <span />
                    </div>
                    <div
                      v-for="(item, index) in envVars"
                      :key="`${item.name}-${index}`"
                      class="grid grid-cols-[minmax(12rem,0.8fr)_minmax(16rem,1.2fr)_2.25rem] gap-2 border-b px-3 py-2 last:border-b-0"
                    >
                      <Input v-model="item.name" class="h-8 font-mono text-xs" autocomplete="off" />
                      <Input v-model="item.defaultValue" class="h-8 font-mono text-xs" autocomplete="off" />
                      <Button
                        size="icon"
                        variant="ghost"
                        class="size-8"
                        @click="removeEnvVar(index)"
                      >
                        <Trash2 class="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="auth" class="mt-4">
            <Card class="max-w-2xl rounded-md">
              <CardHeader class="pb-3">
                <CardTitle class="text-base">
                  Авторизация
                </CardTitle>
              </CardHeader>
              <CardContent class="space-y-3">
                <div class="space-y-2">
                  <Label>Профиль по умолчанию</Label>
                  <Select v-model="defaultAuthProfileIdentity">
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="Не задан" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem :value="NO_AUTH_PROFILE">
                        Не задан
                      </SelectItem>
                      <SelectItem
                        v-for="profile in activeAuthProfiles"
                        :key="profile.identity"
                        :value="profile.identity"
                      >
                        {{ profile.label }} ({{ profile.adapterId }})
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="localization" class="mt-4">
            <Card class="rounded-md">
              <CardHeader class="pb-3">
                <CardTitle class="text-base">
                  Локализация
                </CardTitle>
              </CardHeader>
              <CardContent class="space-y-4">
                <div class="grid gap-3 md:grid-cols-2">
                  <div class="space-y-2">
                    <Label>Локаль по умолчанию</Label>
                    <Select v-model="defaultLocale">
                      <SelectTrigger class="w-full">
                        <SelectValue placeholder="Выберите локаль" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="locale in localeOptions"
                          :key="locale.code"
                          :value="locale.code"
                        >
                          {{ locale.label }} ({{ locale.code }})
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div class="space-y-2">
                    <Label>Резервная локаль</Label>
                    <Select v-model="fallbackLocale">
                      <SelectTrigger class="w-full">
                        <SelectValue placeholder="Выберите локаль" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="locale in localeOptions"
                          :key="locale.code"
                          :value="locale.code"
                        >
                          {{ locale.label }} ({{ locale.code }})
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div class="space-y-2">
                  <div class="flex items-center justify-between gap-3">
                    <Label>Доступные локали</Label>
                    <Button size="sm" variant="outline" class="gap-2" @click="addLocale">
                      <Plus class="size-4" />
                      Добавить
                    </Button>
                  </div>

                  <div class="overflow-hidden rounded-md border bg-background">
                    <div class="grid grid-cols-[0.8fr_minmax(14rem,1.8fr)_0.7fr_0.7fr_2.25rem] gap-2 border-b bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground">
                      <span>Код</span>
                      <span>Отображение</span>
                      <span>Кратко</span>
                      <span>Направление</span>
                      <span />
                    </div>
                    <div
                      v-for="(locale, index) in locales"
                      :key="`${locale.code}-${index}`"
                      class="grid grid-cols-[0.8fr_minmax(14rem,1.8fr)_0.7fr_0.7fr_2.25rem] gap-2 border-b px-3 py-2 last:border-b-0"
                    >
                      <Input v-model="locale.code" class="h-8" />
                      <Input v-model="locale.displayName" class="h-8" />
                      <Input v-model="locale.shortLabel" class="h-8" />
                      <Select
                        :model-value="locale.direction ?? 'ltr'"
                        @update:model-value="value => updateDirection(locale, String(value))"
                      >
                        <SelectTrigger class="h-8 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ltr">
                            LTR
                          </SelectItem>
                          <SelectItem value="rtl">
                            RTL
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="ghost"
                        class="size-8"
                        :disabled="locales.length <= 1"
                        @click="removeLocale(index)"
                      >
                        <Trash2 class="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  </div>
</template>
