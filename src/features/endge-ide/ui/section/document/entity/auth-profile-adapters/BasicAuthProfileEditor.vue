<script setup lang="ts">
import { computed } from 'vue'
import AuthCredentialField from './AuthCredentialField.vue'
const props = defineProps<{ config: Record<string, unknown>, credentials: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:config': [Record<string, unknown>], 'update:credentials': [Record<string, unknown>] }>()
function credential(key: string) { return computed({ get: () => String(props.credentials[key] ?? ''), set: value => emit('update:credentials', { ...props.credentials, [key]: value }) }) }
const username = credential('username')
const password = credential('password')
</script>
<template><div class="grid gap-3 sm:grid-cols-2"><AuthCredentialField v-model="username" label="Username" :secret="false" /><AuthCredentialField v-model="password" label="Password" /></div></template>
