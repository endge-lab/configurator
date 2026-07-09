<script setup lang="ts">
import type { EndgeWorkspaceLocale } from '@endge/core'

import { Endge } from '@endge/core'
import { useDomainStore } from '@endge/vue'
import { Check, Plus, Trash2 } from 'lucide-vue-next'
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

type LocaleDirection = 'ltr' | 'rtl'

const NO_AUTH_PROFILE = '__none__'

const domainStore = useDomainStore()
const workspaceVersion = ref(0)
const defaultAuthProfileIdentity = ref(NO_AUTH_PROFILE)
const defaultLocale = ref('')
const fallbackLocale = ref('')
const locales = ref<EndgeWorkspaceLocale[]>([])
const activeTab = ref<'auth' | 'localization'>('auth')

const offWorkspace = Endge.workspace.subscribe(() => {
  workspaceVersion.value += 1
})
onScopeDispose(offWorkspace)

const workspace = computed(() => {
  workspaceVersion.value
  return Endge.workspace.current
})

const activeAuthProfiles = computed(() =>
  (domainStore.authProfiles ?? [])
    .filter((profile: any) => profile?.deletedAt == null && profile?.active !== false)
    .map((profile: any) => ({
      identity: String(profile.identity ?? profile.id ?? '').trim(),
      label: String(profile.displayName ?? profile.name ?? profile.identity ?? profile.id ?? '').trim(),
      adapterId: String(profile.adapterId ?? '').trim(),
    }))
    .filter(profile => profile.identity),
)

const localeOptions = computed(() =>
  locales.value
    .map(locale => ({
      code: String(locale.code ?? '').trim(),
      label: String(locale.nativeLabel || locale.label || locale.code || '').trim(),
    }))
    .filter(locale => locale.code),
)

watchEffect(() => {
  const current = workspace.value
  locales.value = current.locales.map(locale => ({ ...locale }))
  defaultLocale.value = current.defaultLocale
  fallbackLocale.value = current.fallbackLocale
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
    label: '',
    nativeLabel: '',
    shortLabel: code.toUpperCase(),
    direction: 'ltr',
  })
  ensureLocaleSelection()
}

function removeLocale(index: number): void {
  locales.value.splice(index, 1)
  ensureLocaleSelection()
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
    const label = String(item.label ?? '').trim() || code
    const nativeLabel = String(item.nativeLabel ?? '').trim() || label
    const shortLabel = String(item.shortLabel ?? '').trim() || code.toUpperCase()
    const direction: LocaleDirection = item.direction === 'rtl' ? 'rtl' : 'ltr'
    result.push({ code, label, nativeLabel, shortLabel, direction })
  }
  return result
}

function applyWorkspaceSettings(): void {
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

  Endge.workspace.apply({
    identity: workspace.value.identity,
    displayName: workspace.value.displayName,
    locales: nextLocales,
    defaultLocale: defaultCode,
    fallbackLocale: fallbackCode,
  })
  Endge.context.setCurrentLocale(defaultCode)

  toast.success('Настройки рабочего пространства применены', {
    description: defaultAuthProfileIdentity.value === NO_AUTH_PROFILE
      ? 'Профиль авторизации по умолчанию пока не задан'
      : `Профиль авторизации: ${defaultAuthProfileIdentity.value}`,
  })
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
      <Button size="sm" class="gap-2" @click="applyWorkspaceSettings">
        <Check class="size-4" />
        Применить
      </Button>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div class="p-4">
        <Tabs v-model="activeTab" class="w-full">
          <TabsList class="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="auth">
              Авторизация
            </TabsTrigger>
            <TabsTrigger value="localization">
              Локализация
            </TabsTrigger>
          </TabsList>

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
                <div class="rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
                  Это поле пока не сохраняется в Payload workspace и нужно для проверки будущей модели.
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
                    <div class="grid grid-cols-[0.8fr_1.2fr_1.2fr_0.7fr_0.7fr_2.25rem] gap-2 border-b bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground">
                      <span>Код</span>
                      <span>Название</span>
                      <span>Отображение</span>
                      <span>Кратко</span>
                      <span>Направление</span>
                      <span />
                    </div>
                    <div
                      v-for="(locale, index) in locales"
                      :key="`${locale.code}-${index}`"
                      class="grid grid-cols-[0.8fr_1.2fr_1.2fr_0.7fr_0.7fr_2.25rem] gap-2 border-b px-3 py-2 last:border-b-0"
                    >
                      <Input v-model="locale.code" class="h-8" />
                      <Input v-model="locale.label" class="h-8" />
                      <Input v-model="locale.nativeLabel" class="h-8" />
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
