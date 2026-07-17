<script setup lang="ts">
import type { EndgeConfiguration } from '@endge/core'

import { Endge } from '@endge/core'
import { onScopeDispose, ref } from 'vue'
import { toast } from 'vue-sonner'

import { ScrollArea } from '@/components/ui/scroll-area'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import ConfigurationSettingsEditor from '@/features/endge-ide/ui/components/configuration/ConfigurationSettingsEditor.vue'
import SaveDocumentButton from '@/features/endge-ide/ui/components/SaveDocumentButton.vue'

const configuration = ref<EndgeConfiguration>(clone(Endge.workspace.current.configuration))

const offWorkspace = Endge.workspace.subscribe(() => {
  configuration.value = clone(Endge.workspace.current.configuration)
})
onScopeDispose(offWorkspace)

async function save(): Promise<void> {
  try {
    await EndgeIDE.runBusy(Endge.schema.saveDocument(Endge.workspace.current.identity, 'workspace', {
      model: {
        identity: Endge.workspace.current.identity,
        displayName: Endge.workspace.current.displayName,
        configuration: configuration.value,
      },
    }))
    toast.success('Рабочее пространство сохранено')
  }
  catch (error: any) {
    toast.error('Не удалось сохранить рабочее пространство', {
      description: String(error?.message ?? error),
    })
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-muted/30">
    <div class="flex h-16 shrink-0 items-center justify-between border-b bg-background px-4">
      <div class="flex min-w-0 items-center gap-2">
        <i class="ti ti-world text-xl text-sky-500" />
        <h2 class="truncate text-lg font-semibold">Рабочее пространство</h2>
      </div>
      <SaveDocumentButton :loading="EndgeIDE.busy.value" @click="save" />
    </div>
    <ScrollArea class="min-h-0 flex-1">
      <div class="p-4">
        <ConfigurationSettingsEditor v-model="configuration" variant="root" />
      </div>
    </ScrollArea>
  </div>
</template>
