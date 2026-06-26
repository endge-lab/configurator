<script setup lang="ts">
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import type { GlobalEvents } from '@/features/@utils/events/EventBus'
import { AppBus } from '@/features/@utils/events/EventBus'

const toast = useToast()

const notifyHandler = (payload: GlobalEvents['notify']) => {
  toast.add({
    severity: payload.severity,
    summary: payload.summary,
    detail: payload.detail,
    life: payload.life ?? 3000,
  })
}

onMounted(() => {
  AppBus.on('notify', notifyHandler)
})

onUnmounted(() => {
  AppBus.off('notify', notifyHandler)
})
</script>

<template>
  <Toast />
</template>
