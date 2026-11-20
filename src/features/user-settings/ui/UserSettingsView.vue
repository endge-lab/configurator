<script setup lang="ts">
import type { EndgeWorkspaceStateOperation } from '@endge/core'
import type {
  UserSettingDefinition,
  UserSettingsContext,
  UserSettingsPerson,
  UserSettingsSnapshot,
} from '../adapters/UserSettingsHttpAdapter'

import { Endge } from '@endge/core'
import { BookOpen, Loader2, Search, Trash2, UserRound } from 'lucide-vue-next'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { Configurator } from '@/app/Configurator'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useEndgeIDEContext } from '@/features/endge-ide/services/context/use-endge-ide-context'

import { UserSettingsHttpAdapter } from '../adapters/UserSettingsHttpAdapter'
import UserSettingsJsonEditor from './UserSettingsJsonEditor.vue'
import WorkspaceStateSyncButton from './WorkspaceStateSyncButton.vue'

const { t, locale } = useI18n()
const context = useEndgeIDEContext()
const currentWorkspace = computed(() => {
  void context.version.value
  return Endge.context.getCurrentWorkspace()
})
const backendUrl = computed(() => {
  void context.version.value
  return Configurator.context.backendConfig?.serviceBackendURL ?? ''
})
const name = computed(() => Endge.workspace.current.displayName || currentWorkspace.value)
const adapter = computed(() => currentWorkspace.value && backendUrl.value
  ? new UserSettingsHttpAdapter(backendUrl.value, currentWorkspace.value)
  : null)
const facetSelectionKey = computed(() => JSON.stringify(context.currentContext().facets))
const switchingContext = computed(() => context.isSwitching())
const catalog = shallowRef<UserSettingDefinition[]>([])
const active = shallowRef<UserSettingsContext | null>(null)
const users = shallowRef<UserSettingsPerson[]>([])
const selected = shallowRef<UserSettingsPerson | null>(null)
const snapshot = shallowRef<UserSettingsSnapshot | null>(null)
const document = ref('')
const original = ref('')
const query = ref('')
const nextCursor = ref('')
const isLoading = ref(false)
const loadingUsers = ref(false)
const loadingDocument = ref(false)
const busy = ref(false)
const error = ref('')
const fieldsError = ref('')
const status = ref('')
const help = ref(false)
const helpSize = ref(28)

function rememberHelpSize(size: number): void {
  if (size >= 20 && size <= 52) {
    helpSize.value = size
  }
}
const confirm = shallowRef<{ scope: UserSettingsContext, user: UserSettingsPerson | null } | null>(null)
const vocabulary = computed(() => locale.value.startsWith('ru') ? 'ru' : 'en')
const activeLabel = computed(() => {
  if (!active.value) {
    return name.value ?? ''
  }
  const { facets, labels } = active.value
  const selections = Object.entries(facets).map(([facet, identity]) =>
    `${labels[facet]?.facet || facet} · ${labels[facet]?.document || identity}`,
  )
  return [name.value, ...selections].filter(Boolean).join(' / ')
})
const workspaceRole = computed(() => {
  void context.version.value
  return Configurator.context.workspaceRole
})
const canEdit = computed(() => workspaceRole.value === 'editor' || workspaceRole.value === 'admin')
const canReset = computed(() => workspaceRole.value === 'admin')
const usesBackend = computed(() => active.value?.driver === 'backend')
const writable = computed(() => canEdit.value && usesBackend.value)
const dirty = computed(() => document.value !== original.value)
let requests = new AbortController()
let peopleRequest: AbortController | undefined
let documentRequest: AbortController | undefined
let debounce: ReturnType<typeof setTimeout> | undefined

function describeError(cause: unknown): string {
  const code = cause instanceof Error ? cause.message : ''
  if (code === 'user_state_operation_invalid') {
    return t('userSettings.invalidSetting')
  }
  return ['workspace_admin_required', 'workspace_editor_required', 'workspace_forbidden', 'user_state_facet_forbidden'].includes(code)
    ? t('userSettings.forbidden')
    : t('userSettings.requestFailed')
}

function clearSelection(): void {
  documentRequest?.abort()
  selected.value = null
  snapshot.value = null
  document.value = original.value = ''
  loadingDocument.value = false
  fieldsError.value = ''
}

async function loadContext(): Promise<void> {
  requests.abort()
  requests = new AbortController()
  const signal = requests.signal
  const api = adapter.value
  clearTimeout(debounce)
  active.value = null
  users.value = []
  nextCursor.value = ''
  loadingUsers.value = false
  clearSelection()
  error.value = ''
  status.value = ''
  confirm.value = null
  busy.value = false
  isLoading.value = !!api || switchingContext.value
  if (!api || switchingContext.value) {
    return
  }
  try {
    const result = await api.context(context.currentContext().facets, signal)
    if (signal.aborted) {
      return
    }
    active.value = result.current
    catalog.value = result.catalog
    if (active.value) {
      await loadUsers()
    }
  }
  catch (cause) {
    if (!signal.aborted) {
      error.value = describeError(cause)
    }
  }
  finally {
    if (!signal.aborted) {
      isLoading.value = false
    }
  }
}

async function loadUsers(append = false): Promise<void> {
  peopleRequest?.abort()
  peopleRequest = new AbortController()
  const signal = AbortSignal.any([requests.signal, peopleRequest.signal])
  const api = adapter.value
  const scope = active.value
  if (!api || !scope) {
    users.value = []
    loadingUsers.value = false
    return
  }
  const cursor = append ? nextCursor.value : ''
  if (!append) {
    users.value = []
    nextCursor.value = ''
  }
  loadingUsers.value = true
  error.value = ''
  try {
    const result = await api.users(scope.facets, query.value, cursor, signal)
    if (!signal.aborted) {
      users.value = append ? [...users.value, ...result.items] : result.items
      nextCursor.value = result.next ?? ''
    }
  }
  catch (cause) {
    if (!signal.aborted) {
      error.value = describeError(cause)
    }
  }
  finally {
    if (!signal.aborted) {
      loadingUsers.value = false
    }
  }
}

function applySnapshot(value: UserSettingsSnapshot): void {
  snapshot.value = value
  original.value = JSON.stringify(Object.fromEntries(value.entries
    .filter(item => !item.deleted)
    .map(item => [item.key, item.value])), null, 2)
  document.value = original.value
}

async function open(person: UserSettingsPerson, pending: EndgeWorkspaceStateOperation[] = []): Promise<void> {
  documentRequest?.abort()
  documentRequest = new AbortController()
  const signal = AbortSignal.any([requests.signal, documentRequest.signal])
  const scope = active.value
  const api = adapter.value
  if (!scope || !api) {
    return
  }
  selected.value = person
  if (!pending.length) {
    snapshot.value = null
    fieldsError.value = ''
    status.value = ''
  }
  loadingDocument.value = true
  error.value = ''
  try {
    const result = await api.read(scope.facets, person.id, signal)
    if (!signal.aborted) {
      applySnapshot(result)
      if (pending.length) {
        const merged = JSON.parse(original.value)
        for (const operation of pending) {
          if (operation.delete) {
            delete merged[operation.key]
          }
          else {
            merged[operation.key] = operation.value
          }
        }
        document.value = JSON.stringify(merged, null, 2)
      }
    }
  }
  catch (cause) {
    if (!signal.aborted) {
      error.value = describeError(cause)
    }
  }
  finally {
    if (!signal.aborted) {
      loadingDocument.value = false
    }
  }
}

function changes(): EndgeWorkspaceStateOperation[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(document.value)
  }
  catch {
    throw new Error(t('userSettings.invalidJson'))
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(t('userSettings.invalidJson'))
  }
  const previous = new Map(snapshot.value?.entries.map(entry => [entry.key, entry]))
  const operations: EndgeWorkspaceStateOperation[] = []
  for (const [key, value] of Object.entries(parsed)) {
    const definition = catalog.value.find(item => item.key === key)
    if (!definition) {
      throw new Error(t('userSettings.unknownKey', { key }))
    }
    const { schema } = definition
    let valid: boolean
    switch (schema.type) {
      case 'integer':
        valid = Number.isInteger(value) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity)
        break
      case 'object':
        valid = value != null && typeof value === 'object' && !Array.isArray(value)
        break
      default:
        valid = typeof value === 'string' && (!schema.enum || schema.enum.includes(value))
    }
    if (!valid) {
      throw new Error(`${key} — ${definition.description[vocabulary.value]}`)
    }
    const entry = previous.get(key)
    if (entry?.deleted || JSON.stringify(entry?.value) !== JSON.stringify(value)) {
      operations.push({ key, value, id: crypto.randomUUID(), baseRevision: entry?.revision ?? 0 })
    }
  }
  for (const [key, entry] of previous) {
    if (!entry.deleted && !Object.hasOwn(parsed, key)) {
      operations.push({ key, delete: true, id: crypto.randomUUID(), baseRevision: entry.revision })
    }
  }
  return operations
}

async function save(): Promise<void> {
  const api = adapter.value
  const scope = active.value
  const person = selected.value
  const current = snapshot.value
  if (!api || !scope || !person || !current || !writable.value || busy.value) {
    return
  }
  fieldsError.value = ''
  status.value = ''
  let operations: EndgeWorkspaceStateOperation[]
  try {
    operations = changes()
  }
  catch (cause) {
    fieldsError.value = (cause as Error).message
    return
  }
  if (!operations.length) {
    applySnapshot(current)
    return
  }
  const signal = requests.signal
  busy.value = true
  error.value = ''
  try {
    const result = await api.save(scope.facets, person.id, current, operations, signal)
    if (!signal.aborted) {
      const reset = result.results.some(item => item.status === 'reset')
      const conflicts = result.results.filter(item => item.status === 'conflict').map(item => item.key)
      await open(person, reset ? [] : operations.filter(operation => conflicts.includes(operation.key)))
      await loadUsers()
      status.value = reset
        ? t('userSettings.wasReset')
        : conflicts.length
          ? t('userSettings.conflict', { keys: conflicts.join(', ') })
          : t('userSettings.saved')
    }
  }
  catch (cause) {
    if (!signal.aborted) {
      error.value = describeError(cause)
    }
  }
  finally {
    if (!signal.aborted) {
      busy.value = false
    }
  }
}

function confirmReset(user: UserSettingsPerson | null): void {
  if (active.value && usesBackend.value && canReset.value) {
    confirm.value = { scope: active.value, user }
  }
}

function onConfirmOpen(open: boolean): void {
  if (!open) {
    confirm.value = null
  }
}

async function reset(): Promise<void> {
  const api = adapter.value
  const target = confirm.value
  if (!api || !target || busy.value || target.scope !== active.value || !usesBackend.value || !canReset.value) {
    return
  }
  const signal = requests.signal
  confirm.value = null
  busy.value = true
  error.value = ''
  status.value = ''
  try {
    const result = await api.reset(target.scope, target.user?.id ?? null, signal)
    if (!signal.aborted) {
      if (!target.user || selected.value?.id === target.user.id) {
        clearSelection()
      }
      await loadUsers()
      status.value = t('userSettings.resetDone', result.deleted)
    }
  }
  catch (cause) {
    if (!signal.aborted) {
      error.value = describeError(cause)
    }
  }
  finally {
    if (!signal.aborted) {
      busy.value = false
    }
  }
}

watch([adapter, facetSelectionKey, switchingContext], loadContext, { immediate: true })
watch(query, () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => void loadUsers(), 250)
})
onScopeDispose(() => {
  requests.abort()
  clearTimeout(debounce)
})
</script>

<template>
  <section class="flex h-full min-h-0 flex-col overflow-auto bg-background" :aria-label="t('userSettings.title')">
    <header class="flex min-h-11 shrink-0 items-center gap-2 border-b px-3 py-1.5">
      <label class="relative block w-full max-w-72 min-w-0">
        <Search class="pointer-events-none absolute top-2 left-2 size-4 text-muted-foreground" />
        <Input v-model="query" class="h-8 pl-8" :placeholder="t('userSettings.search')" :aria-label="t('userSettings.search')" :disabled="!active || busy" />
      </label>
      <div class="ml-auto flex shrink-0 items-center gap-1">
        <WorkspaceStateSyncButton />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="size-8"
                :class="{ 'bg-muted text-primary': help }"
                :aria-label="t('userSettings.help')"
                :aria-expanded="help"
                :disabled="!catalog.length"
                @click="help = !help"
              >
                <BookOpen class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ t('userSettings.help') }}</TooltipContent>
          </Tooltip>
          <Tooltip v-if="canReset">
            <TooltipTrigger as-child>
              <span class="inline-flex">
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8 text-destructive"
                  :aria-label="t('userSettings.resetAll')"
                  :disabled="!usesBackend || busy"
                  @click="confirmReset(null)"
                >
                  <Trash2 class="size-4" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{{ t('userSettings.resetAll') }}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
    <p v-if="error" role="alert" class="border-b border-destructive/25 bg-destructive/5 px-5 py-3 text-sm text-destructive">
      {{ error }}
    </p>
    <p v-if="status" role="status" class="border-b px-5 py-2 text-sm">
      {{ status }}
    </p>
    <p v-if="isLoading || !active" class="p-5 text-sm text-muted-foreground">
      {{ isLoading ? t('userSettings.loading') : t('userSettings.noContexts') }}
    </p>
    <template v-else>
      <p v-if="!writable" class="border-b bg-muted/30 px-5 py-2 text-xs text-muted-foreground">
        {{ usesBackend ? t('userSettings.readOnly') : t('userSettings.history') }}
      </p>
      <SplitterGroup direction="horizontal" class="min-h-0 flex-1 overflow-hidden">
        <SplitterPanel id="user-settings-main" :default-size="100 - helpSize" :min-size="46" class="min-w-0">
          <div class="grid h-full min-h-0 grid-cols-1" :class="selected ? 'md:grid-cols-[minmax(12rem,16rem)_1fr]' : ''">
            <div class="min-h-28 overflow-auto" :class="selected ? 'border-b md:border-r md:border-b-0' : ''">
              <p v-if="!users.length" class="px-4 py-5 text-sm text-muted-foreground">
                {{ loadingUsers ? t('userSettings.loading') : t('userSettings.noUsers') }}
              </p>
              <ul v-else class="divide-y">
                <li v-for="person in users" :key="person.id">
                  <button
                    type="button"
                    class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60"
                    :class="{ 'bg-muted font-medium': selected?.id === person.id }"
                    :aria-pressed="selected?.id === person.id"
                    :disabled="busy"
                    @click="open(person)"
                  >
                    <UserRound class="size-4 shrink-0 text-muted-foreground" />
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm">{{ person.displayName || person.username }}</span>
                      <span v-if="person.displayName && person.username" class="block truncate text-xs text-muted-foreground">{{ person.username }}</span>
                    </span>
                    <span class="font-mono text-xs text-muted-foreground">{{ person.count }}</span>
                  </button>
                </li>
              </ul>
              <Button v-if="nextCursor" variant="ghost" class="m-2" size="sm" :disabled="loadingUsers || busy" @click="loadUsers(true)">
                {{ t('userSettings.more') }}
              </Button>
            </div>
            <div v-if="selected" class="flex min-h-64 min-w-0 flex-col overflow-hidden">
              <p v-if="!selected || !snapshot" class="p-5 text-sm text-muted-foreground">
                {{ loadingDocument ? t('userSettings.loading') : t('userSettings.selectUser') }}
              </p>
              <template v-else>
                <div class="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                  <h3 class="min-w-0 truncate text-sm font-semibold">
                    {{ selected.displayName || selected.username }}
                  </h3>
                  <div class="flex flex-wrap gap-2">
                    <Button v-if="canReset" variant="ghost" class="text-destructive" size="sm" :disabled="!usesBackend || busy" @click="confirmReset(selected)">
                      <Trash2 class="size-4" /> {{ t('userSettings.resetUser') }}
                    </Button>
                    <Button v-if="canEdit" size="sm" :disabled="!writable || !dirty || busy" @click="save">
                      <Loader2 v-if="busy" class="size-4 animate-spin" />{{ t('userSettings.save') }}
                    </Button>
                  </div>
                </div>
                <UserSettingsJsonEditor v-model="document" :catalog="catalog" :read-only="!writable || busy" />
                <p v-if="fieldsError" role="alert" class="border-t px-4 py-2 text-xs text-destructive">
                  {{ fieldsError }}
                </p>
              </template>
            </div>
          </div>
        </SplitterPanel>
        <template v-if="help">
          <SplitterResizeHandle
            id="user-settings-help-resize"
            class="group relative flex w-2.5 shrink-0 items-center justify-center border-x bg-muted/30 outline-none hover:bg-muted focus-visible:bg-muted"
            :aria-label="t('userSettings.resizeHelp')"
          >
            <span class="h-8 w-px rounded bg-border group-hover:bg-foreground/40 group-focus-visible:bg-foreground/40" />
          </SplitterResizeHandle>
          <SplitterPanel
            id="user-settings-help"
            :default-size="helpSize"
            :min-size="20"
            :max-size="52"
            class="min-w-0"
            @resize="rememberHelpSize"
          >
            <aside class="h-full overflow-auto bg-muted/15" :aria-label="t('userSettings.help')">
              <h3 class="sticky top-0 border-b bg-background px-4 py-3 text-sm font-semibold">
                {{ t('userSettings.help') }}
              </h3>
              <dl class="divide-y px-4">
                <div v-for="item in catalog" :key="item.key" class="py-3">
                  <dt class="break-all font-mono text-xs font-medium">
                    {{ item.key }}
                  </dt>
                  <dd class="mt-1 text-xs leading-5 text-muted-foreground">
                    {{ item.description[vocabulary] }}
                    <template v-if="item.default != null">
                      {{ t('userSettings.default', { value: item.default }) }}
                    </template>
                  </dd>
                </div>
              </dl>
            </aside>
          </SplitterPanel>
        </template>
      </SplitterGroup>
    </template>
    <AlertDialog :open="!!confirm" @update:open="onConfirmOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ confirm?.user ? t('userSettings.confirmUserTitle') : t('userSettings.confirmAllTitle') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ confirm?.user
              ? t('userSettings.confirmUser', { user: confirm.user.displayName || confirm.user.username, context: activeLabel })
              : t('userSettings.confirmAll', { context: activeLabel }) }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('userSettings.cancel') }}</AlertDialogCancel>
          <Button variant="destructive" :disabled="!canReset || !usesBackend || busy" @click="reset">
            {{ t('userSettings.deleteConfirm') }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>
