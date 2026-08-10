<script setup lang="ts">
import type { AuthLoginMode } from '@endge/core'

import { computed } from 'vue'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const props = defineProps<{
  config: Record<string, unknown>
  credentialRefs: Record<string, unknown>
}>()

const emit = defineEmits<{
  'update:config': [Record<string, unknown>]
  'update:credentialRefs': [Record<string, unknown>]
}>()

const loginMode = computed<AuthLoginMode>({
  get: () => props.config.loginMode === 'service' ? 'service' : 'interactive',
  set: (value) => {
    setConfig('loginMode', value)
    if (value === 'interactive')
      emit('update:credentialRefs', {})
  },
})
const baseUrl = configString('baseUrl')
const clientId = configString('clientId')
const scope = configString('scope', 'openid profile email')
const refreshSkewMs = computed({
  get: () => Number(props.config.refreshSkewMs ?? 30_000),
  set: value => setConfig('refreshSkewMs', Number(value)),
})
const tokenPath = configString('tokenPath', '/token')
const logoutPath = configString('logoutPath', '/logout')
const userinfoPath = configString('userinfoPath', '/userinfo')
const usernameRef = credentialRefString('username')
const passwordRef = credentialRefString('password')

function configString(key: string, fallback = '') {
  return computed({
    get: () => String(props.config[key] ?? fallback),
    set: value => setConfig(key, value),
  })
}

function credentialRefString(key: string) {
  return computed({
    get: () => String(props.credentialRefs[key] ?? ''),
    set: value => emit('update:credentialRefs', { ...props.credentialRefs, [key]: value }),
  })
}

function setConfig(key: string, value: unknown): void {
  emit('update:config', { ...props.config, [key]: value })
}
</script>

<template>
  <div class="grid gap-4">
    <div class="space-y-1.5">
      <Label class="text-xs text-muted-foreground">Режим входа</Label>
      <Select v-model="loginMode">
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="interactive">interactive</SelectItem>
          <SelectItem value="service">service</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="space-y-1.5">
      <Label class="text-xs text-muted-foreground">Base URL</Label>
      <Input v-model="baseUrl" autocomplete="off" />
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">Client ID</Label>
        <Input v-model="clientId" autocomplete="off" />
      </div>
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">Scope</Label>
        <Input v-model="scope" autocomplete="off" />
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">Refresh skew (ms)</Label>
        <Input v-model="refreshSkewMs" type="number" min="0" autocomplete="off" />
      </div>
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">Userinfo endpoint</Label>
        <Input v-model="userinfoPath" autocomplete="off" />
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">Token endpoint</Label>
        <Input v-model="tokenPath" autocomplete="off" />
      </div>
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">Logout endpoint</Label>
        <Input v-model="logoutPath" autocomplete="off" />
      </div>
    </div>

    <div v-if="loginMode === 'service'" class="grid gap-3 border-t pt-4 sm:grid-cols-2">
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">Username credential ref</Label>
        <Input v-model="usernameRef" autocomplete="off" />
      </div>
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">Password credential ref</Label>
        <Input v-model="passwordRef" autocomplete="off" />
      </div>
    </div>
  </div>
</template>
