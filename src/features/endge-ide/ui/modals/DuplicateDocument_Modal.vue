<script setup lang="ts">
import type { DomainDocumentType } from '@endge/core'

import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import { duplicateEntity } from '@/features/endge-ide/model/domain/domain-duplicate'

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
  if (!props.source) return
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
        <DialogTitle>Дублировать документ</DialogTitle>
      </DialogHeader>

      <div v-if="source" class="space-y-4 py-2">
        <p class="text-sm text-muted-foreground">
          Создаётся копия «{{ source.name }}» в корне секции. Укажите новый идентификатор и название.
        </p>
        <div class="grid gap-2">
          <Label for="dup-identity">Identity</Label>
          <Input
            id="dup-identity"
            v-model="identity"
            placeholder="Уникальный идентификатор"
          />
        </div>
        <div class="grid gap-2">
          <Label for="dup-name">Название</Label>
          <Input
            id="dup-name"
            v-model="name"
            placeholder="Название копии"
          />
        </div>
      </div>

      <DialogFooter class="gap-2">
        <Button variant="outline" :disabled="loading" @click="onCancel">
          Отменить
        </Button>
        <Button :disabled="loading" @click="onSubmit">
          Дублировать
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
