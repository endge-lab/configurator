<script setup lang="ts">
import { computed } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import AuthCredentialField from './AuthCredentialField.vue'

const props = defineProps<{ config: Record<string, unknown>, credentials: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:config': [Record<string, unknown>], 'update:credentials': [Record<string, unknown>] }>()
function configString(key: string) {
  return computed({ get: () => String(props.config[key] ?? ''), set: value => emit('update:config', { ...props.config, [key]: value }) })
}
const tokenEndpoint = configString('tokenEndpoint')
const clientId = configString('clientId')
const clientAuthentication = configString('clientAuthentication')
const scopes = computed({ get: () => Array.isArray(props.config.scopes) ? props.config.scopes.join(' ') : '', set: value => emit('update:config', { ...props.config, scopes: String(value).split(/[\s,]+/).filter(Boolean) }) })
const clientSecret = computed({ get: () => String(props.credentials.clientSecret ?? ''), set: value => emit('update:credentials', { clientSecret: value }) })
</script>

<template>
  <div class="grid gap-3">
    <div class="space-y-1.5">
      <Label class="text-xs text-muted-foreground">Token endpoint</Label><Input v-model="tokenEndpoint" placeholder="{SERVICE_TOKEN_ENDPOINT}" autocomplete="off" />
    </div><div class="grid gap-3 sm:grid-cols-2">
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">Client ID</Label><Input v-model="clientId" autocomplete="off" />
      </div><div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">Scopes</Label><Input v-model="scopes" autocomplete="off" />
      </div>
    </div><div class="grid gap-3 sm:grid-cols-2">
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">Client authentication</Label><Select v-model="clientAuthentication">
          <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="client_secret_basic">
              client_secret_basic
            </SelectItem><SelectItem value="client_secret_post">
              client_secret_post
            </SelectItem>
          </SelectContent>
        </Select>
      </div><AuthCredentialField v-model="clientSecret" label="Client secret" />
    </div>
  </div>
</template>
