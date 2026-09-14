<script setup lang="ts">
import { computed, ref } from 'vue'

import { useI18n } from 'vue-i18n'
import { Configurator } from '@/app/Configurator'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const open = defineModel<boolean>('open', { default: false })
const session = Configurator.remoteDebugger
const input = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const pending = session.pendingFile
const records = computed(
  () =>
    pending.value?.value.inspection?.chunks.flatMap(chunk => chunk.records)
    ?? [],
)
const astCount = computed(
  () =>
    Object.values(pending.value?.value.bundle?.artifacts ?? {}).filter(
      artifact =>
        artifact.payload
        && typeof artifact.payload === 'object'
        && 'ast' in artifact.payload,
    ).length,
)
async function read(file?: File): Promise<void> {
  if (!file) {
    return
  }
  busy.value = true
  try {
    await session.prepareFile(file)
  }
  finally {
    busy.value = false
  }
}
function change(event: Event): void {
  void read((event.target as HTMLInputElement).files?.[0])
}
function cancel(): void {
  session.cancelFile()
  open.value = false
}
async function install(): Promise<void> {
  busy.value = true
  try {
    await session.installPendingFile()
    if (!session.pendingFile.value) {
      open.value = false
    }
  }
  finally {
    busy.value = false
  }
}
const { t } = useI18n()
</script>

<template>
  <Dialog :open="open" @update:open="(value) => !value && cancel()">
    <DialogContent>
      <DialogHeader>
        <DialogTitle> {{ t('bundleInspection.loadTitle') }} </DialogTitle><DialogDescription>
          {{ t('bundleInspection.loadHelp') }}
        </DialogDescription>
      </DialogHeader>
      <input
        ref="input"
        type="file"
        class="hidden"
        accept=".gz,.json,.endge-bundle.gz,.endge-bundle.json"
        data-testid="bundle-file-input"
        @change="change"
      >
      <button
        type="button"
        class="min-h-28 rounded border border-dashed p-6 text-sm hover:bg-muted"
        :disabled="busy"
        @click="input?.click()"
      >
        {{
          busy ? t('bundleInspection.reading') : t('bundleInspection.dropFile')
        }}
      </button>
      <div
        v-if="pending"
        class="space-y-1 text-sm"
        data-testid="bundle-summary"
      >
        <p class="break-all font-medium">
          {{ pending.name }}
        </p>
        <p>
          {{ t('bundleInspection.programLabel') }} {{ pending.value.bundle?.programId ?? "Продолжение текущей записи" }}
        </p>
        <p v-if="pending.value.bundle">
          {{ t('bundleInspection.documentsLabel') }} {{ Object.keys(pending.value.bundle.catalog.documents).length }} {{ t('bundleInspection.artifactsLabel') }} {{ Object.keys(pending.value.bundle.artifacts).length }} {{ t('bundleInspection.astLabel') }} {{ astCount }}
        </p>
        <p>
          {{ t('bundleInspection.historyLabel') }} {{
            records.length
              ? `${records.length} записей · ${records[0]?.sequence}–${records.at(-1)?.sequence}`
              : t('bundleInspection.absent')
          }}
        </p>
      </div>
      <p
        v-if="session.fileError.value"
        role="alert"
        class="text-sm text-destructive"
      >
        {{ session.fileError.value }}
      </p>
      <DialogFooter>
        <Button variant="outline" @click="cancel">
          {{ t('bundleInspection.cancel') }}
        </Button><Button :disabled="!pending || busy" @click="install">
          {{ pending?.value.bundle ? t('bundleInspection.open') : t('bundleInspection.append') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
