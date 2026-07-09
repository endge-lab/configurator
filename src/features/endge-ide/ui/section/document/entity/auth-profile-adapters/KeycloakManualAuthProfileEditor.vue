<script setup lang="ts">
import { computed } from 'vue'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const props = defineProps<{
  config: Record<string, unknown>
  credentialRefs: Record<string, unknown>
}>()

const emit = defineEmits<{
  'update:config': [Record<string, unknown>]
  'update:credentialRefs': [Record<string, unknown>]
}>()

const keycloakBaseUrl = configString('KeycloakBaseUrl')
const storageKey = configString('storageKey')
const clientId = configString('clientId')
const scope = configString('scope')
const refreshSkewMs = configString('refreshSkewMs')
const tokenPath = configString('tokenPath')
const logoutPath = configString('logoutPath')
const login = configString('login')
const password = configString('password')

function configString(key: string, fallback = '') {
  return computed({
    get: () => String(props.config?.[key] ?? fallback),
    set: value => setConfig(key, value),
  })
}

function setConfig(key: string, value: unknown): void {
  emit('update:config', {
    ...(props.config ?? {}),
    [key]: value,
  })
}
</script>

<template>
  <div class="grid gap-3">
    <div class="space-y-1.5">
      <Label class="text-xs text-muted-foreground">Keycloak Base URL</Label>
      <Input v-model="keycloakBaseUrl" autocomplete="off" />
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">Storage Key</Label>
        <Input v-model="storageKey" autocomplete="off" />
      </div>
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">Client ID</Label>
        <Input v-model="clientId" autocomplete="off" />
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">Scope</Label>
        <Input v-model="scope" autocomplete="off" />
      </div>
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">Refresh skew (ms)</Label>
        <Input v-model="refreshSkewMs" type="number" min="0" autocomplete="off" />
        <div class="text-xs text-muted-foreground">
          За сколько миллисекунд до истечения токена инициировать refresh.
        </div>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">Token endpoint path</Label>
        <Input v-model="tokenPath" autocomplete="off" />
      </div>
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">Logout endpoint path</Label>
        <Input v-model="logoutPath" autocomplete="off" />
      </div>
    </div>

    <div class="grid gap-3 border-t pt-4 sm:grid-cols-2">
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">Login</Label>
        <Input v-model="login" autocomplete="off" />
      </div>
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">Password</Label>
        <Input v-model="password" type="password" autocomplete="new-password" />
      </div>
    </div>
  </div>
</template>
