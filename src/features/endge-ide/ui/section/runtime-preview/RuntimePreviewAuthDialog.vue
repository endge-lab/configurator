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
        <DialogTitle>{{ $t('uiText.runtimePreviewAuthorization54e41ed8') }}</DialogTitle>
        <DialogDescription v-if="current">
          {{ $t('uiText.profileEb0b9b0d') }} {{ current.displayName || current.identity }} ({{ (prompt?.currentIndex ?? 0) + 1 }} {{ $t('uiText.fromBeed1688') }} {{ prompt?.profiles.length ?? 0 }}{{ $t('uiText.requiresExternalOidcLogin81ce3875') }}
        </DialogDescription>
      </DialogHeader>
      <p v-if="prompt?.error" class="text-sm text-destructive" role="alert">
        {{ prompt.error }}
      </p>
      <DialogFooter>
        <Button variant="outline" :disabled="prompt?.pending" @click="preview.cancelAuthorization()">
          {{ $t('uiText.cancel0ec753be') }}
        </Button>
        <Button :disabled="prompt?.pending || !current" @click="preview.authorizeNextProfile()">
          <Loader2 v-if="prompt?.pending" class="mr-2 size-4 animate-spin" />
          {{ $t('uiText.openLoginWindow51df2057') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
