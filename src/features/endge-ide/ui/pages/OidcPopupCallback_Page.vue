<script setup lang="ts">
import { OidcBrowserSession_Service } from '@endge/core'
import { onMounted, ref } from 'vue'

const completed = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    await OidcBrowserSession_Service.completeStoredPopupCallback()
    completed.value = true
    window.close()
  }
  catch (value: unknown) {
    error.value = value instanceof Error ? value.message : String(value)
  }
})
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-background p-6">
    <div class="max-w-md space-y-2 rounded-md border p-5 text-center">
      <h1 class="font-semibold">{{ error ? 'Вход не завершён' : completed ? 'Вход завершён' : 'Завершаем вход…' }}</h1>
      <p class="text-sm text-muted-foreground" role="status">{{ error || (completed ? 'Можно закрыть это окно.' : 'Подождите несколько секунд.') }}</p>
    </div>
  </main>
</template>
