<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EndgeIDE } from '@/features/endge-ide/model/kernel/endge-ide'

const preview = EndgeIDE.runtimePreview
const prompt = preview.authPrompt
const current = computed(() => prompt.value?.profiles[prompt.value.currentIndex] ?? null)
</script>

<template>
  <Dialog :open="Boolean(prompt)" @update:open="value => { if (!value) preview.cancelAuthorization() }">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Авторизация Runtime Preview</DialogTitle>
        <DialogDescription v-if="current">
          Профиль {{ current.displayName || current.identity }} ({{ (prompt?.currentIndex ?? 0) + 1 }} из {{ prompt?.profiles.length ?? 0 }}) требует внешнего OIDC-входа.
        </DialogDescription>
      </DialogHeader>
      <p v-if="prompt?.error" class="text-sm text-destructive" role="alert">
        {{ prompt.error }}
      </p>
      <DialogFooter>
        <Button variant="outline" :disabled="prompt?.pending" @click="preview.cancelAuthorization()">
          Отмена
        </Button>
        <Button :disabled="prompt?.pending || !current" @click="preview.authorizeNextProfile()">
          <Loader2 v-if="prompt?.pending" class="mr-2 size-4 animate-spin" />
          Открыть окно входа
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
