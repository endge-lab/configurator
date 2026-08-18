<script setup lang="ts">
import { computed } from 'vue'
import AuthCredentialField from './AuthCredentialField.vue'
const props = defineProps<{ config: Record<string, unknown>, credentials: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:config': [Record<string, unknown>], 'update:credentials': [Record<string, unknown>] }>()
const token = computed({ get: () => String(props.credentials.token ?? ''), set: value => emit('update:credentials', { token: value }) })
</script>
<template><AuthCredentialField v-model="token" label="Bearer token" /></template>
