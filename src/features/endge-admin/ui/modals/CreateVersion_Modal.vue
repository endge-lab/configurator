<script setup lang="ts">
import { Endge, RVersion } from '@endge/core'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const identity = ref('')
const description = ref('')
const loading = ref(false)

const openModel = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

watch(() => props.open, (v) => {
  if (v) {
    identity.value = ''
    description.value = ''
  }
})

async function onSubmit(): Promise<void> {
  const id = identity.value.trim()
  if (!id) {
    toast.error('Введите название версии')
    return
  }
  loading.value = true
  try {
    const repos = Endge.schema.repositories
    if (!repos) throw new Error('Репозитории не инициализированы')
    const data = Endge.domain.toPlain()
    const created = await repos.versions.create({ identity: id, description: description.value.trim(), data })
    const doc = created?.doc ?? created
    if (doc?.id != null) {
      Endge.domain.addVersion(RVersion.fromPayload(doc))
    }
    await Endge.schema.loadVersionsList()
    toast.success('Версия создана', { description: id })
    openModel.value = false
  }
  catch (e: any) {
    toast.error('Ошибка создания версии', { description: e?.message ?? String(e) })
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
    <DialogContent class="sm:max-w-[420px]">
      <DialogHeader>
        <DialogTitle>Создать версию</DialogTitle>
        <DialogDescription>
          Текущее состояние домена будет сохранено как новая версия. Укажите название и описание.
        </DialogDescription>
      </DialogHeader>
      <div class="grid gap-4 py-4">
        <div class="grid gap-2">
          <Label for="version-identity">Название</Label>
          <Input
            id="version-identity"
            v-model="identity"
            placeholder="Например: 2025-02-21-snapshot"
          />
        </div>
        <div class="grid gap-2">
          <Label for="version-desc">Описание</Label>
          <Textarea
            id="version-desc"
            v-model="description"
            placeholder="Краткое описание изменений"
            rows="3"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" :disabled="loading" @click="onCancel">
          Отмена
        </Button>
        <Button :disabled="loading" @click="onSubmit">
          {{ loading ? 'Сохранение…' : 'Создать' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
