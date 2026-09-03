<script setup lang="ts">
import { computed } from 'vue'

import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

import AuthCredentialField from './AuthCredentialField.vue'

const props = defineProps<{ config: Record<string, unknown>, credentials: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:config': [Record<string, unknown>], 'update:credentials': [Record<string, unknown>] }>()

function configString(key: string) {
  return computed({
    get: () => String(props.config[key] ?? ''),
    set: value => emit('update:config', { ...props.config, [key]: value }),
  })
}

function credential(key: string) {
  return computed({
    get: () => String(props.credentials[key] ?? ''),
    set: value => emit('update:credentials', { ...props.credentials, [key]: value }),
  })
}

const tokenEndpoint = configString('tokenEndpoint')
const clientId = configString('clientId')
const scopes = computed({
  get: () => Array.isArray(props.config.scopes) ? props.config.scopes.join(' ') : '',
  set: value => emit('update:config', { ...props.config, scopes: String(value).split(/[\s,]+/).filter(Boolean) }),
})
const username = credential('username')
const password = credential('password')
</script>

<template>
  <div class="grid gap-3">
    <div class="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-muted-foreground">
      {{ $t('uiText.passwordGrantStoresUserCredentialsAndIsIntendedOnlyF6210e1b5') }}
    </div>
    <div class="space-y-1.5">
      <Label class="text-xs text-muted-foreground">{{ $t('uiText.tokenEndpoint949fda72') }}</Label>
      <Input v-model="tokenEndpoint" placeholder="{KEYCLOAK_TOKEN_ENDPOINT}" autocomplete="off" />
    </div>
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">{{ $t('uiText.clientIDa766cd7f') }}</Label>
        <Input v-model="clientId" autocomplete="off" />
      </div>
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">{{ $t('uiText.scopesc23540e5') }}</Label>
        <Input v-model="scopes" placeholder="openid email" autocomplete="off" />
      </div>
    </div>
    <div class="grid gap-3 sm:grid-cols-2">
      <AuthCredentialField v-model="username" label="Username" :secret="false" />
      <AuthCredentialField v-model="password" label="Password" />
    </div>
  </div>
</template>
