<script setup lang="ts">
import type {
  AgentAccessOwnerFilter,
  AgentAccessScope,
  AgentAccessToken,
  AgentTokenExpiryPreset,
  CreatedAgentAccessToken,
} from '@/features/agent-access/domain/types/agent-access.type'

import type { AgentAccessErrorKey } from '@/features/agent-access/services/agent-access-errors'
import { Bot, Copy, Eye, EyeOff, KeyRound, Loader2, RefreshCw, TriangleAlert } from 'lucide-vue-next'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { toast } from 'vue-sonner'
import { Configurator } from '@/app/Configurator'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { agentAccessErrorKey, canIssueAgentCommit } from '@/features/agent-access/services/agent-access-errors'
import { buildAgentPrompt } from '@/features/agent-access/services/agent-prompt'
import {
  AGENT_TOKEN_EXPIRY_PRESETS,
  isExpiryPresetAvailable,
  resolveAgentTokenExpiry,
  toDateTimeLocalValue,
} from '@/features/agent-access/services/agent-token-expiry'
import { maskAgentToken } from '@/features/agent-access/services/agent-token-mask'
import { copyTextToClipboard } from '@/shared/tools/clipboard'

const props = defineProps<{
  documentationUrl?: string
}>()

const openState = ref(false)

const { t, locale } = useI18n()
const agentAccess = Configurator.agentAccess
const fieldId = useId()

const activeTab = ref<'create' | 'tokens'>('create')
const name = ref('')
const scope = ref<AgentAccessScope>('read')
const allowCommit = ref(false)
const allowDelete = ref(false)
const preset = ref<AgentTokenExpiryPreset>('1d')
const customExpiry = ref('')
const isCreating = ref(false)
const submitErrorKey = ref<AgentAccessErrorKey | null>(null)
// Секрет живёт только в состоянии открытого диалога и очищается при закрытии.
const created = ref<CreatedAgentAccessToken | null>(null)
const tokenVisible = ref(false)
const confirmRevokeId = ref<string | null>(null)
const revokingId = ref<string | null>(null)

const session = computed(() => {
  const state = Configurator.session.state
  return state.status === 'authenticated' ? state.session : null
})
const isPlatformAdmin = computed(() => session.value?.platformAdmin === true)
const workspaceIdentity = computed(() => Configurator.context.activeWorkspaceIdentity ?? '')
const workspaceDisplayName = computed(() =>
  session.value?.workspaces.find(workspace => workspace.identity === workspaceIdentity.value)?.displayName,
)
const canWrite = computed(() => isPlatformAdmin.value || ['editor', 'admin'].includes(Configurator.context.workspaceRole ?? ''))
const canCommit = computed(() => canIssueAgentCommit(Configurator.context.workspaceRole, isPlatformAdmin.value))
const maxTtlSeconds = computed(() => agentAccess.maxTtlSeconds.value)
const maxTtlLabel = computed(() => {
  const seconds = maxTtlSeconds.value
  if (seconds == null) {
    return ''
  }
  return seconds >= 86400
    ? t('agentAccess.form.maxTtlDays', { count: Math.floor(seconds / 86400) })
    : t('agentAccess.form.maxTtlHours', { count: Math.floor(seconds / 3600) })
})
const customMin = computed(() => toDateTimeLocalValue(new Date(Date.now() + 5 * 60 * 1000)))
const customMax = computed(() =>
  maxTtlSeconds.value == null ? undefined : toDateTimeLocalValue(new Date(Date.now() + maxTtlSeconds.value * 1000)),
)
const expiry = computed(() => resolveAgentTokenExpiry(preset.value, customExpiry.value, new Date(), maxTtlSeconds.value))
const expiryHint = computed(() => {
  const result = expiry.value
  let text: string
  if (result.ok) {
    text = t('agentAccess.form.expiresAt', { date: formatDate(result.expiresAt.toISOString()) })
  }
  else {
    text = expiryErrorText(result.reason)
  }
  return { error: !result.ok, text: [text, maxTtlLabel.value].filter(Boolean).join(' · ') }
})
const canSubmit = computed(() =>
  !isCreating.value && Boolean(workspaceIdentity.value) && name.value.trim().length > 0 && expiry.value.ok,
)
const ownerFilter = computed(() => agentAccess.owner.value)
const tokens = computed(() => agentAccess.tokens.value)

const promptPreview = computed(() => created.value ? renderPrompt(created.value, maskAgentToken(created.value.token)) : '')
const displayedToken = computed(() => {
  if (!created.value) {
    return ''
  }
  return tokenVisible.value ? created.value.token : maskAgentToken(created.value.token)
})

function expiryErrorText(reason: 'required' | 'invalid' | 'tooSoon' | 'tooLong'): string {
  switch (reason) {
    case 'required': return t('agentAccess.expiryErrors.required')
    case 'invalid': return t('agentAccess.expiryErrors.invalid')
    case 'tooSoon': return t('agentAccess.expiryErrors.tooSoon')
    default: return t('agentAccess.expiryErrors.tooLong')
  }
}

function errorText(key: AgentAccessErrorKey): string {
  switch (key) {
    case 'agentAccess.errors.expiryRequired': return t('agentAccess.errors.expiryRequired')
    case 'agentAccess.errors.expiryInvalid': return t('agentAccess.errors.expiryInvalid')
    case 'agentAccess.errors.expiryTooLong': return t('agentAccess.errors.expiryTooLong')
    case 'agentAccess.errors.flagsRequireWrite': return t('agentAccess.errors.flagsRequireWrite')
    case 'agentAccess.errors.scopeInvalid': return t('agentAccess.errors.scopeInvalid')
    case 'agentAccess.errors.nameInvalid': return t('agentAccess.errors.nameInvalid')
    case 'agentAccess.errors.descriptionInvalid': return t('agentAccess.errors.descriptionInvalid')
    case 'agentAccess.errors.scopeExceedsRole': return t('agentAccess.errors.scopeExceedsRole')
    case 'agentAccess.errors.commitRequiresAdmin': return t('agentAccess.errors.commitRequiresAdmin')
    case 'agentAccess.errors.notFound': return t('agentAccess.errors.notFound')
    case 'agentAccess.errors.workspaceNotFound': return t('agentAccess.errors.workspaceNotFound')
    case 'agentAccess.errors.workspaceForbidden': return t('agentAccess.errors.workspaceForbidden')
    case 'agentAccess.errors.platformAdminRequired': return t('agentAccess.errors.platformAdminRequired')
    case 'agentAccess.errors.unavailable': return t('agentAccess.errors.unavailable')
    default: return t('agentAccess.errors.unknown')
  }
}

function prefixLabel(token: AgentAccessToken): string {
  return `${token.tokenPrefix}…`
}

function presetLabel(value: AgentTokenExpiryPreset): string {
  switch (value) {
    case '1h': return t('agentAccess.form.preset1h')
    case '1d': return t('agentAccess.form.preset1d')
    case '7d': return t('agentAccess.form.preset7d')
    default: return t('agentAccess.form.presetCustom')
  }
}

function statusLabel(token: AgentAccessToken): string {
  switch (token.status) {
    case 'revoked': return t('agentAccess.list.statusRevoked')
    case 'expired': return t('agentAccess.list.statusExpired')
    default: return t('agentAccess.list.statusActive')
  }
}

function rightsLabel(token: AgentAccessToken): string {
  if (token.scope === 'read') {
    return t('agentAccess.list.rightsRead')
  }
  return [
    t('agentAccess.list.rightsWrite'),
    token.commit ? t('agentAccess.list.rightsCommit') : '',
    token.delete ? t('agentAccess.list.rightsDelete') : '',
  ].filter(Boolean).join(' · ')
}

function ownerLabel(token: AgentAccessToken): string {
  return token.owner.displayName || token.owner.username || token.owner.id
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return t('agentAccess.list.never')
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function renderPrompt(value: CreatedAgentAccessToken, token: string): string {
  return buildAgentPrompt({
    backendURL: Configurator.connections.activeBackendURL,
    workspaceIdentity: value.accessToken.workspaceIdentity,
    workspaceDisplayName: value.accessToken.workspaceDisplayName ?? workspaceDisplayName.value,
    tokenName: value.accessToken.name,
    token,
    scope: value.accessToken.scope,
    commit: value.accessToken.commit,
    delete: value.accessToken.delete,
    expiresAt: value.accessToken.expiresAt,
    documentationURL: props.documentationUrl,
  })
}

function resetForm(): void {
  name.value = t('agentAccess.form.defaultName', { workspace: workspaceDisplayName.value || workspaceIdentity.value })
  scope.value = 'read'
  allowCommit.value = false
  allowDelete.value = false
  preset.value = '1d'
  customExpiry.value = ''
  submitErrorKey.value = null
  created.value = null
  tokenVisible.value = false
}

function clearSecret(): void {
  created.value = null
  tokenVisible.value = false
}

function onOpenChange(value: boolean): void {
  openState.value = value
  if (value) {
    activeTab.value = 'create'
    resetForm()
    void agentAccess.refresh(isPlatformAdmin.value ? ownerFilter.value : 'me')
  }
  else {
    clearSecret()
    confirmRevokeId.value = null
  }
}

defineExpose({ open: () => onOpenChange(true) })

function setScope(value: AgentAccessScope): void {
  scope.value = value
  if (value === 'read') {
    allowCommit.value = false
    allowDelete.value = false
  }
}

async function createToken(): Promise<void> {
  const resolved = expiry.value
  if (!canSubmit.value || !resolved.ok) {
    return
  }
  isCreating.value = true
  submitErrorKey.value = null
  try {
    created.value = await agentAccess.create({
      workspaceIdentity: workspaceIdentity.value,
      name: name.value.trim(),
      scope: scope.value,
      commit: scope.value === 'write' && canCommit.value && allowCommit.value,
      delete: scope.value === 'write' && allowDelete.value,
      expiresAt: resolved.expiresAt.toISOString(),
    })
    tokenVisible.value = false
  }
  catch (error) {
    submitErrorKey.value = agentAccessErrorKey(error)
  }
  finally {
    isCreating.value = false
  }
}

async function copyPrompt(): Promise<void> {
  if (created.value) {
    notifyCopy(await copyTextToClipboard(renderPrompt(created.value, created.value.token)))
  }
}

async function copyToken(): Promise<void> {
  if (created.value) {
    notifyCopy(await copyTextToClipboard(created.value.token))
  }
}

function notifyCopy(copied: boolean): void {
  if (copied) {
    toast.success(t('agentAccess.result.copied'))
  }
  else {
    toast.error(t('agentAccess.result.copyFailed'))
  }
}

function createAnother(): void {
  resetForm()
}

function switchOwner(value: AgentAccessOwnerFilter): void {
  confirmRevokeId.value = null
  void agentAccess.refresh(value)
}

async function revoke(token: AgentAccessToken): Promise<void> {
  revokingId.value = token.id
  try {
    await agentAccess.revoke(token.id)
    toast.success(t('agentAccess.list.revoked'))
  }
  catch (error) {
    toast.error(errorText(agentAccessErrorKey(error)))
  }
  finally {
    revokingId.value = null
    confirmRevokeId.value = null
  }
}
</script>

<template>
  <Dialog :open="openState" @update:open="onOpenChange">
    <DialogContent class="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
      <DialogHeader class="border-b bg-muted/35 px-6 py-5 text-left">
        <DialogTitle class="flex items-center gap-2">
          <Bot class="size-4 text-fuchsia-500" />
          {{ t('agentAccess.title') }}
        </DialogTitle>
        <DialogDescription>{{ t('agentAccess.description') }}</DialogDescription>
      </DialogHeader>

      <Tabs v-model="activeTab" class="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList class="mx-6 mt-4 w-fit">
          <TabsTrigger value="create">
            {{ t('agentAccess.tabs.create') }}
          </TabsTrigger>
          <TabsTrigger value="tokens">
            {{ t('agentAccess.tabs.tokens') }}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <form v-if="!created" class="space-y-5" @submit.prevent="createToken">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <Label :for="`${fieldId}-name`">{{ t('agentAccess.form.name') }}</Label>
                <Input
                  :id="`${fieldId}-name`"
                  v-model="name"
                  maxlength="120"
                  autocomplete="off"
                  :placeholder="t('agentAccess.form.namePlaceholder')"
                />
              </div>
              <div class="space-y-2">
                <Label :for="`${fieldId}-workspace`">{{ t('agentAccess.form.workspace') }}</Label>
                <Input
                  :id="`${fieldId}-workspace`"
                  :model-value="workspaceDisplayName ? `${workspaceDisplayName} · ${workspaceIdentity}` : workspaceIdentity"
                  disabled
                />
              </div>
            </div>

            <fieldset class="space-y-2">
              <legend class="text-sm font-medium">
                {{ t('agentAccess.form.rights') }}
              </legend>
              <div class="inline-flex rounded-md border p-0.5" role="radiogroup">
                <button
                  type="button"
                  role="radio"
                  :aria-checked="scope === 'read'"
                  class="rounded px-3 py-1 text-sm transition-colors"
                  :class="scope === 'read' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'"
                  @click="setScope('read')"
                >
                  {{ t('agentAccess.form.read') }}
                </button>
                <button
                  type="button"
                  role="radio"
                  :aria-checked="scope === 'write'"
                  :disabled="!canWrite"
                  class="rounded px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  :class="scope === 'write' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'"
                  @click="setScope('write')"
                >
                  {{ t('agentAccess.form.write') }}
                </button>
              </div>
              <p class="text-xs text-muted-foreground">
                {{ !canWrite ? t('agentAccess.form.writeUnavailable') : scope === 'write' ? t('agentAccess.form.writeHint') : t('agentAccess.form.readHint') }}
              </p>
              <div class="grid gap-2 pt-1 sm:grid-cols-2">
                <label
                  class="flex items-start gap-2 text-sm"
                  :class="scope !== 'write' || !canCommit ? 'opacity-50' : ''"
                  :title="canCommit ? undefined : t('agentAccess.form.commitUnavailable')"
                  data-testid="agent-access-commit"
                >
                  <Checkbox
                    :model-value="canCommit && allowCommit"
                    :disabled="scope !== 'write' || !canCommit"
                    class="mt-0.5"
                    @update:model-value="value => allowCommit = value === true"
                  />
                  <span>
                    <span class="block font-medium">{{ t('agentAccess.form.commit') }}</span>
                    <span class="text-xs text-muted-foreground">{{ canCommit ? t('agentAccess.form.commitHint') : t('agentAccess.form.commitUnavailable') }}</span>
                  </span>
                </label>
                <label class="flex items-start gap-2 text-sm" :class="scope !== 'write' ? 'opacity-50' : ''">
                  <Checkbox
                    :model-value="allowDelete"
                    :disabled="scope !== 'write'"
                    class="mt-0.5"
                    @update:model-value="value => allowDelete = value === true"
                  />
                  <span>
                    <span class="block font-medium">{{ t('agentAccess.form.delete') }}</span>
                    <span class="text-xs text-muted-foreground">{{ t('agentAccess.form.deleteHint') }}</span>
                  </span>
                </label>
              </div>
            </fieldset>

            <fieldset class="space-y-2">
              <legend class="text-sm font-medium">
                {{ t('agentAccess.form.expiry') }}
              </legend>
              <div class="flex flex-wrap gap-1.5" role="radiogroup">
                <button
                  v-for="item in AGENT_TOKEN_EXPIRY_PRESETS"
                  :key="item"
                  type="button"
                  role="radio"
                  :aria-checked="preset === item"
                  :disabled="!isExpiryPresetAvailable(item, maxTtlSeconds)"
                  class="rounded-md border px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  :class="preset === item ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'"
                  @click="preset = item"
                >
                  {{ presetLabel(item) }}
                </button>
              </div>
              <div v-if="preset === 'custom'" class="max-w-xs space-y-1">
                <Label :for="`${fieldId}-expiry`" class="text-xs text-muted-foreground">{{ t('agentAccess.form.customDate') }}</Label>
                <input
                  :id="`${fieldId}-expiry`"
                  v-model="customExpiry"
                  type="datetime-local"
                  :min="customMin"
                  :max="customMax"
                  class="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
              </div>
              <p class="text-xs" :class="expiryHint.error ? 'text-destructive' : 'text-muted-foreground'">
                {{ expiryHint.text }}
              </p>
            </fieldset>

            <div v-if="submitErrorKey" class="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              <TriangleAlert class="mt-0.5 size-4 shrink-0" />
              <span>{{ errorText(submitErrorKey) }}</span>
            </div>

            <div class="flex justify-end">
              <Button type="submit" :disabled="!canSubmit">
                <Loader2 v-if="isCreating" class="size-4 animate-spin" />
                <KeyRound v-else class="size-4" />
                {{ isCreating ? t('agentAccess.form.creating') : t('agentAccess.form.create') }}
              </Button>
            </div>
          </form>

          <div v-else class="space-y-4">
            <div class="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300">
              <TriangleAlert class="mt-0.5 size-4 shrink-0" />
              <span>
                <span class="block font-medium">{{ t('agentAccess.result.title') }}</span>
                {{ t('agentAccess.result.once') }}
              </span>
            </div>

            <div class="space-y-2">
              <Label :for="`${fieldId}-token`">{{ t('agentAccess.result.token') }}</Label>
              <div class="flex items-center gap-2">
                <Input
                  :id="`${fieldId}-token`"
                  :model-value="displayedToken"
                  class="font-mono text-xs"
                  readonly
                  autocomplete="off"
                  spellcheck="false"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  class="size-9 shrink-0"
                  :aria-label="tokenVisible ? t('agentAccess.result.hide') : t('agentAccess.result.show')"
                  :title="tokenVisible ? t('agentAccess.result.hide') : t('agentAccess.result.show')"
                  @click="tokenVisible = !tokenVisible"
                >
                  <EyeOff v-if="tokenVisible" class="size-4" />
                  <Eye v-else class="size-4" />
                </Button>
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <Button type="button" @click="copyPrompt">
                <Copy class="size-4" />
                {{ t('agentAccess.result.copyPrompt') }}
              </Button>
              <Button type="button" variant="outline" @click="copyToken">
                <KeyRound class="size-4" />
                {{ t('agentAccess.result.copyToken') }}
              </Button>
            </div>

            <p v-if="!props.documentationUrl" class="text-xs text-muted-foreground">
              {{ t('agentAccess.result.docsMissing') }}
            </p>

            <div class="space-y-1.5">
              <p class="text-xs font-medium text-muted-foreground">
                {{ t('agentAccess.result.promptPreview') }}
              </p>
              <pre class="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">{{ promptPreview }}</pre>
            </div>

            <div class="flex justify-end gap-2">
              <Button type="button" variant="outline" @click="createAnother">
                {{ t('agentAccess.result.another') }}
              </Button>
              <Button type="button" @click="onOpenChange(false)">
                {{ t('agentAccess.result.done') }}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tokens" class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div class="mb-3 flex items-center gap-2">
            <div v-if="isPlatformAdmin" class="inline-flex rounded-md border p-0.5" role="radiogroup">
              <button
                v-for="value in (['me', 'all'] as const)"
                :key="value"
                type="button"
                role="radio"
                :aria-checked="ownerFilter === value"
                class="rounded px-3 py-1 text-sm transition-colors"
                :class="ownerFilter === value ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'"
                @click="switchOwner(value)"
              >
                {{ value === 'me' ? t('agentAccess.list.mine') : t('agentAccess.list.all') }}
              </button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              class="ml-auto"
              :disabled="agentAccess.status.value === 'loading'"
              @click="agentAccess.refresh()"
            >
              <RefreshCw class="size-3.5" :class="agentAccess.status.value === 'loading' ? 'animate-spin' : ''" />
              {{ t('agentAccess.list.refresh') }}
            </Button>
          </div>

          <div v-if="agentAccess.status.value === 'error'" class="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <TriangleAlert class="mt-0.5 size-4 shrink-0" />
            <span>{{ errorText(agentAccessErrorKey(agentAccess.errorCode.value ?? '')) }}</span>
          </div>
          <p v-else-if="agentAccess.status.value === 'loading' && !tokens.length" class="text-sm text-muted-foreground">
            {{ t('agentAccess.list.loading') }}
          </p>
          <p v-else-if="!tokens.length" class="text-sm text-muted-foreground">
            {{ t('agentAccess.list.empty') }}
          </p>

          <ul v-else class="divide-y rounded-lg border">
            <li
              v-for="token in tokens"
              :key="token.id"
              class="flex flex-wrap items-start gap-x-4 gap-y-1 px-3.5 py-3 text-sm"
              :class="token.status !== 'active' ? 'opacity-60' : ''"
            >
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex items-center gap-2">
                  <span class="truncate font-medium">{{ token.name }}</span>
                  <span
                    class="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
                    :class="token.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'"
                  >
                    {{ statusLabel(token) }}
                  </span>
                </div>
                <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <dt>{{ t('agentAccess.list.prefix') }}</dt>
                  <dd class="font-mono">
                    {{ prefixLabel(token) }}
                  </dd>
                  <dt>{{ t('agentAccess.list.workspace') }}</dt>
                  <dd>{{ token.workspaceDisplayName || token.workspaceIdentity }}</dd>
                  <dt>{{ t('agentAccess.list.rights') }}</dt>
                  <dd>{{ rightsLabel(token) }}</dd>
                  <dt>{{ t('agentAccess.list.expires') }}</dt>
                  <dd>{{ formatDate(token.expiresAt) }}</dd>
                  <dt>{{ t('agentAccess.list.lastUsed') }}</dt>
                  <dd>{{ formatDate(token.lastUsedAt) }}</dd>
                  <template v-if="ownerFilter === 'all'">
                    <dt>{{ t('agentAccess.list.owner') }}</dt>
                    <dd>{{ ownerLabel(token) }}</dd>
                  </template>
                </dl>
              </div>
              <div v-if="token.status === 'active'" class="flex shrink-0 items-center gap-1.5">
                <template v-if="confirmRevokeId === token.id">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    :disabled="revokingId === token.id"
                    @click="revoke(token)"
                  >
                    <Loader2 v-if="revokingId === token.id" class="size-3.5 animate-spin" />
                    {{ t('agentAccess.list.confirmRevoke') }}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" @click="confirmRevokeId = null">
                    {{ t('agentAccess.list.cancelRevoke') }}
                  </Button>
                </template>
                <Button v-else type="button" size="sm" variant="outline" @click="confirmRevokeId = token.id">
                  {{ t('agentAccess.list.revoke') }}
                </Button>
              </div>
            </li>
          </ul>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>
