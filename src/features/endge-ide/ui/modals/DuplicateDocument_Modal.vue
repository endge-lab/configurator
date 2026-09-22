<script setup lang="ts">
import type { DomainDocumentType } from '@endge/core'

import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import { duplicateEntity } from '@/features/endge-ide/services/domain/domain-duplicate'

export interface DuplicateSourcePayload {
  id: string
  docType: string
  name: string
}

const props = defineProps<{
  open: boolean
  source: DuplicateSourcePayload | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const identity = ref('')
const name = ref('')
const loading = ref(false)

const openModel = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

watch(
  () => [props.open, props.source] as const,
  ([open, source]) => {
    if (open && source) {
      identity.value = ''
      name.value = `Копия ${source.name}`.trim()
    }
  },
)

async function onSubmit(): Promise<void> {
  const newIdentity = identity.value.trim()
  if (!newIdentity) {
    toast.error('Введите идентификатор (identity)')
    return
  }
  if (!props.source) {
    return
  }
  loading.value = true
  try {
    await duplicateEntity(
      props.source.id,
      props.source.docType as DomainDocumentType,
      newIdentity,
      name.value.trim() || newIdentity,
    )
    EndgeIDE.tabs.openDocument(newIdentity, props.source.docType as DomainDocumentType)
    toast.success('Документ дублирован', { description: newIdentity })
    openModel.value = false
  }
  catch (e: unknown) {
    toast.error('Ошибка дублирования', {
      description: (e as Error)?.message ?? String(e),
    })
  }
  finally {
    loading.value = false
  }
}

function onCancel(): void {
  openModel.value = false
}
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ $t('uiText.duplicateDocument041a414a') }}</DialogTitle>
      </DialogHeader>

      <div v-if="source" class="space-y-4 py-2">
        <p class="text-sm text-muted-foreground">
          {{ $t('uiText.copy15da5cd8') }}{{ source.name }}{{ $t('uiText.atTheRootOfTheSectionSpecifyANewI2f73f8c3') }}
        </p>
        <div class="grid gap-2">
          <Label for="dup-identity">{{ $t('uiText.identity7e5a975b') }}</Label>
          <Input
            id="dup-identity"
            v-model="identity"
            placeholder="Уникальный идентификатор"
          />
        </div>
        <div class="grid gap-2">
          <Label for="dup-name">{{ $t('uiText.name3de49828') }}</Label>
          <Input
            id="dup-name"
            v-model="name"
            placeholder="Название копии"
          />
        </div>
      </div>

      <DialogFooter class="gap-2">
        <Button variant="outline" :disabled="loading" @click="onCancel">
          {{ $t('uiText.cancel555ad1c0') }}
        </Button>
        <Button :disabled="loading" @click="onSubmit">
          {{ $t('uiText.duplicateC9a3458c') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
