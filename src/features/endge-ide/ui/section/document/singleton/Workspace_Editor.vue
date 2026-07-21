<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { EndgeConfiguration, EndgeDataMode } from '@endge/core'

import { Endge } from '@endge/core'
import { DatabaseZap } from 'lucide-vue-next'
import { onScopeDispose, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import ConfigurationSettingsEditor from '@/features/endge-ide/ui/components/configuration/ConfigurationSettingsEditor.vue'
import SaveDocumentButton from '@/features/endge-ide/ui/components/SaveDocumentButton.vue'

const configuration = ref<EndgeConfiguration>(clone(Endge.workspace.current.configuration))
const dataMode = ref<EndgeDataMode>(Endge.workspace.current.dataMode)

const offWorkspace = Endge.workspace.subscribe(() => {
  configuration.value = clone(Endge.workspace.current.configuration)
  dataMode.value = Endge.workspace.current.dataMode
})
onScopeDispose(offWorkspace)

async function save(): Promise<void> {
  try {
    const previousEffectiveDataMode = Endge.context.dataMode
    await EndgeIDE.runBusy(Endge.schema.saveDocument(Endge.workspace.current.identity, 'workspace', {
      model: {
        identity: Endge.workspace.current.identity,
        displayName: Endge.workspace.current.displayName,
        dataMode: dataMode.value,
        configuration: configuration.value,
      },
    }))
    if (previousEffectiveDataMode !== Endge.context.dataMode) {
      await EndgeIDE.runtimePreview.restartForDataModeChange()
    }
    toast.success('Рабочее пространство сохранено')
  }
  catch (error: any) {
    toast.error('Не удалось сохранить рабочее пространство', {
      description: String(error?.message ?? error),
    })
  }
}

function toggleWorkspaceMockMode(): void {
  dataMode.value = dataMode.value === 'mock' ? 'live' : 'mock'
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
    <div class="min-h-0 flex-1 overflow-hidden p-4">
      <ConfigurationSettingsEditor v-model="configuration" variant="root">
        <template #general>
          <section class="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-card/70 px-4 py-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-foreground">
                Mock-данные по умолчанию
              </p>
              <p class="mt-1 text-xs leading-5 text-muted-foreground">
                Workspace default для runtime-приложений. Локальное переопределение конфигуратора имеет приоритет.
              </p>
            </div>
            <TooltipProvider :delay-duration="200">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    class="shrink-0"
                    :class="dataMode === 'mock' && 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary'"
                    :aria-pressed="dataMode === 'mock'"
                    aria-label="Переключить mock-данные Workspace"
                    @click="toggleWorkspaceMockMode"
                  >
                    <DatabaseZap class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" class="max-w-80 text-xs leading-5">
                  Режим по умолчанию для runtime-приложений. При включении внешние Query не выполняются, а Store использует RMock. Локальный флаг конфигуратора всегда имеет приоритет.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </section>
        </template>
      </ConfigurationSettingsEditor>
    </div>
  </div>
</template>
