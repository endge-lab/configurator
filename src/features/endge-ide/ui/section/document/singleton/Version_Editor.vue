<script setup lang="ts">
import type { RVersion } from '@endge/core'

import { Endge } from '@endge/core'
import { Download } from 'lucide-vue-next'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const props = defineProps<{
  tabContext?: { version: RVersion }
}>()

const version = () => props.tabContext?.version
const loading = ref(false)

async function download(): Promise<void> {
  const v = version()
  if (!v) return
  loading.value = true
  try {
    const repos = Endge.schema.repositories
    if (!repos) throw new Error('Репозитории не инициализированы')
    const full = await repos.versions.findById(v.id)
    const data = full?.doc?.data ?? full?.data
    if (data === undefined) throw new Error('Данные версии недоступны')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${v.identity || v.id}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Файл скачан', { description: a.download })
  }
  catch (e: any) {
    toast.error('Ошибка скачивания', { description: e?.message ?? String(e) })
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="!version()" class="flex items-center justify-center h-full text-sm text-muted-foreground">
    Версия не выбрана
  </div>
  <div v-else class="flex flex-col h-full">
    <div class="border-b p-4 space-y-4">
      <div class="grid gap-2">
        <Label>Название (identity)</Label>
        <Input :model-value="version()!.identity" readonly class="bg-muted" />
      </div>
      <div class="grid gap-2">
        <Label>Описание</Label>
        <Textarea
          :model-value="version()!.description || '-'"
          readonly
          rows="4"
          class="bg-muted resize-none"
          placeholder="Нет описания"
        />
      </div>
      <Button :disabled="loading" @click="download">
        <Download class="size-4 mr-2" />
        {{ loading ? 'Загрузка…' : 'Скачать' }}
      </Button>
    </div>
  </div>
</template>
