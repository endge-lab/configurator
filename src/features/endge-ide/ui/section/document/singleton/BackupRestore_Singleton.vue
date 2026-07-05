<script setup lang="ts">
import { Upload, RefreshCcw } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import {
  importBackupRestoreSelection,
  parseBackupRestoreFile,
} from '@/features/endge-ide/model/backup/backup-restore.ts'
import type { BackupRestoreParsedFile } from '@/features/endge-ide/domain/types/backup-restore.types'

const fileInput = ref<HTMLInputElement | null>(null)
const parsed = ref<BackupRestoreParsedFile | null>(null)
const selection = ref<Record<string, boolean>>({})

const groupedItems = computed(() => {
  const groups = new Map<string, NonNullable<typeof parsed.value>['items']>()
  for (const item of parsed.value?.items ?? []) {
    const list = groups.get(item.sectionTitle) ?? []
    list.push(item)
    groups.set(item.sectionTitle, list)
  }
  return Array.from(groups.entries()).map(([title, items]) => ({
    title,
    items,
  }))
})

const selectedKeys = computed(() => {
  return Object.entries(selection.value)
    .filter(([, enabled]) => enabled === true)
    .map(([key]) => key)
})

const selectedCount = computed(() => selectedKeys.value.length)

function resetSelection(next: BackupRestoreParsedFile | null): void {
  if (!next) {
    selection.value = {}
    return
  }
  selection.value = Object.fromEntries(next.items.map(item => [item.key, true]))
}

function openFileDialog(): void {
  fileInput.value?.click()
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file)
    return

  try {
    const text = await file.text()
    const next = parseBackupRestoreFile(text, file.name)
    parsed.value = next
    resetSelection(next)
    toast.success('Backup-файл загружен', {
      description: `${next.items.length} сущностей найдено`,
    })
  }
  catch (error) {
    parsed.value = null
    resetSelection(null)
    toast.error('Не удалось загрузить backup', {
      description: String(error),
    })
  }
  finally {
    if (input)
      input.value = ''
  }
}

function toggleAll(enabled: boolean): void {
  const next: Record<string, boolean> = {}
  for (const item of parsed.value?.items ?? [])
    next[item.key] = enabled
  selection.value = next
}

async function importSelected(): Promise<void> {
  if (!parsed.value) {
    toast.error('Сначала выберите backup-файл')
    return
  }
  if (!selectedKeys.value.length) {
    toast.error('Выберите хотя бы одну сущность для импорта')
    return
  }

  try {
    const result = await EndgeIDE.runBusy(importBackupRestoreSelection(parsed.value, selectedKeys.value))
    toast.success('Импорт завершён', {
      description: `Импортировано: ${result.importedCount}, заменено: ${result.replacedCount}, создано: ${result.createdCount}`,
    })
  }
  catch (error) {
    toast.error('Ошибка импорта', {
      description: String(error),
    })
  }
}
</script>

<template>
  <div class="h-full p-4 md:p-6 overflow-hidden">
    <div class="mx-auto flex h-full max-w-6xl flex-col gap-4">
      <Card class="p-4 md:p-5">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div class="space-y-1">
            <div class="text-lg font-semibold">
              Резервное восстановление
            </div>
            <div class="text-sm text-muted-foreground">
              Загрузите backup JSON, просмотрите распознанные сущности и импортируйте выбранные записи по `identity`.
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <input
              ref="fileInput"
              type="file"
              accept=".json,application/json"
              class="hidden"
              @change="onFileChange"
            >
            <Button variant="outline" @click="openFileDialog">
              <Upload class="mr-2 size-4" />
              Выбрать backup
            </Button>
            <Button variant="outline" :disabled="!parsed" @click="toggleAll(true)">
              Выбрать всё
            </Button>
            <Button variant="outline" :disabled="!parsed" @click="toggleAll(false)">
              Снять всё
            </Button>
            <Button :disabled="!parsed || !selectedCount" @click="importSelected">
              <RefreshCcw class="mr-2 size-4" />
              Импортировать
            </Button>
          </div>
        </div>

        <div v-if="parsed" class="mt-4 grid gap-3 text-sm md:grid-cols-4">
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs uppercase tracking-wide text-muted-foreground">
              Файл
            </div>
            <div class="mt-1 font-medium break-all">
              {{ parsed.fileName }}
            </div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs uppercase tracking-wide text-muted-foreground">
              Формат
            </div>
            <div class="mt-1 font-medium">
              {{ parsed.source === 'bundle' ? 'Bundle с domain' : 'Plain domain' }}
            </div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs uppercase tracking-wide text-muted-foreground">
              Найдено
            </div>
            <div class="mt-1 font-medium">
              {{ parsed.items.length }}
            </div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs uppercase tracking-wide text-muted-foreground">
              Выбрано
            </div>
            <div class="mt-1 font-medium">
              {{ selectedCount }}
            </div>
          </div>
        </div>
      </Card>

      <Card class="min-h-0 flex-1 overflow-hidden p-0">
        <ScrollArea class="h-full">
          <div v-if="!parsed" class="p-6 text-sm text-muted-foreground">
            Backup-файл ещё не загружен.
          </div>

          <div v-else class="space-y-6 p-4 md:p-5">
            <section
              v-for="group in groupedItems"
              :key="group.title"
              class="space-y-3"
            >
              <div class="flex items-center justify-between">
                <div class="text-sm font-semibold">
                  {{ group.title }}
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ group.items.length }} шт.
                </div>
              </div>

              <div class="overflow-hidden rounded-xl border">
                <div
                  v-for="item in group.items"
                  :key="item.key"
                  class="grid grid-cols-[auto_1fr_auto] items-start gap-3 border-b px-4 py-3 last:border-b-0"
                >
                  <Checkbox
                    :checked="selection[item.key] === true"
                    @update:checked="selection[item.key] = !!$event"
                  />

                  <div class="min-w-0">
                    <div class="font-medium truncate">
                      {{ item.title }}
                    </div>
                    <div class="mt-1 text-xs text-muted-foreground break-all">
                      identity: {{ item.identity }}
                    </div>
                    <div class="mt-1 text-xs text-muted-foreground">
                      backup id: {{ item.importedId ?? 'null' }}
                      <template v-if="item.existsInCurrentDomain">
                        · текущее id: {{ item.currentId ?? 'null' }}
                      </template>
                    </div>
                  </div>

                  <div
                    class="rounded-md px-2 py-1 text-xs font-medium"
                    :class="item.existsInCurrentDomain ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'"
                  >
                    {{ item.existsInCurrentDomain ? 'replace' : 'create' }}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>
      </Card>
    </div>
  </div>
</template>
