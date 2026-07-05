import { defineStore } from 'pinia'

export const useAdminStore = defineStore('endge-admin-store', () => {
  const authDialogVisible = ref(false)

  function openAuthDialog(): void {
    authDialogVisible.value = true
  }

  function closeAuthDialog(): void {
    authDialogVisible.value = false
  }

  return {
    authDialogVisible,
    openAuthDialog,
    closeAuthDialog,
  }
})
