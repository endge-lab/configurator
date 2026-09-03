<script setup lang="ts">
import { CheckCircle2, Loader2, XCircle } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { Configurator } from '@/app/Configurator'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

const props = defineProps<{ config: Record<string, unknown>, credentials: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:config': [Record<string, unknown>], 'update:credentials': [Record<string, unknown>] }>()
function configString(key: string) {
  return computed({ get: () => String(props.config[key] ?? ''), set: value => emit('update:config', { ...props.config, [key]: value }) })
}
const issuer = configString('issuer')
const clientId = configString('clientId')
const scopes = computed({ get: () => Array.isArray(props.config.scopes) ? props.config.scopes.join(' ') : '', set: value => emit('update:config', { ...props.config, scopes: [...new Set(String(value).split(/[\s,]+/).map(item => item.trim()).filter(Boolean))] }) })
const discovery = ref<{ status: 'idle' | 'checking' | 'available' | 'error', message: string }>({ status: 'idle', message: 'Discovery ещё не проверен.' })

async function checkDiscovery(): Promise<void> {
  discovery.value = { status: 'checking', message: 'Проверяем OpenID Discovery…' }
  try {
    await Configurator.oidcDiscovery.check(issuer.value)
    discovery.value = { status: 'available', message: 'Discovery доступен, обязательные endpoints найдены.' }
  }
  catch (error) {
    discovery.value = { status: 'error', message: error instanceof Error ? error.message : String(error) }
  }
}
</script>

<template>
  <div class="grid gap-3">
    <div class="space-y-1.5">
      <Label class="text-xs text-muted-foreground">{{ $t('uiText.issuer2587e48b') }}</Label>
      <div class="flex gap-2">
        <Input v-model="issuer" placeholder="{OIDC_ISSUER}" autocomplete="off" />
        <Button type="button" variant="outline" :disabled="discovery.status === 'checking'" @click="checkDiscovery">
          <Loader2 v-if="discovery.status === 'checking'" class="mr-2 size-4 animate-spin" />
          {{ $t('uiText.check52dec92e') }}
        </Button>
      </div>
      <p class="flex items-center gap-1.5 text-xs" :class="discovery.status === 'error' ? 'text-destructive' : 'text-muted-foreground'">
        <CheckCircle2 v-if="discovery.status === 'available'" class="size-3.5 text-primary" />
        <XCircle v-else-if="discovery.status === 'error'" class="size-3.5" />
        {{ discovery.message }}
      </p>
    </div>
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">{{ $t('uiText.clientIdA766cd7f') }}</Label><Input v-model="clientId" autocomplete="off" />
      </div>
      <div class="space-y-1.5">
        <Label class="text-xs text-muted-foreground">{{ $t('uiText.scopesC23540e5') }}</Label><Input v-model="scopes" placeholder="openid profile" autocomplete="off" />
      </div>
    </div>
  </div>
</template>
