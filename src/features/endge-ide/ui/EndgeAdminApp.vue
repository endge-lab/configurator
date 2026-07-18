<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import { HeartPulse } from 'lucide-vue-next'
import { computed } from 'vue'

import { showWidget } from '@/components/layouts/grid'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import { clearPulseSelection, showPulseOverview } from '@/features/endge-ide/model/pulse/pulse.mock.ts'
import ActiveUsers_Header from '@/features/endge-ide/ui/section/header/ActiveUsers_Header.vue'
import EditorView from '@/features/endge-ide/ui/views/Editor_View.vue'

const tabs = EndgeIDE.tabs
const isBusy = computed(() => EndgeIDE.busy.value)

async function saveCurrentDocument(): Promise<void> {
  await tabs.save()
}

function openDSLPlayground(): void {
  tabs.openDSLPlayground()
}

function openSFCPlayground(): void {
  tabs.openSFCPlayground()
}

function openActionPlaygroundsSingleton(): void {
  tabs.openActionPlaygroundsSingleton()
}

function openBackupRestoreSingleton(): void {
  tabs.openBackupRestoreSingleton()
}

function openUIEditorDemoSingleton(): void {
  tabs.openUIEditorDemoSingleton()
}

function openDomainAnalysis(): void {
  EndgeIDE.tabs.openDomainAnalysis()
}

function openPulse(): void {
  clearPulseSelection()
  showPulseOverview()
  EndgeIDE.tabs.openPulseTab()
}

function openPulseFromHeader(): void {
  showWidget('domain')
  openPulse()
}

function openArchitecture(): void {
  EndgeIDE.tabs.openArchitecture()
}
</script>

<template>
  <Teleport to="[data-target='grid-layout-header-menu']" defer>
    <nav class="flex items-center gap-1 text-xs font-medium">
      <!-- Схема / документ -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="px-2 py-1 rounded-md hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Файл
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-56"
          align="start"
          side="bottom"
          :side-offset="4"
        >
          <DropdownMenuItem :disabled="isBusy" @click="saveCurrentDocument">
            {{ isBusy ? 'Подождите…' : 'Сохранить текущий документ' }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Плагины -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="px-2 py-1 rounded-md hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Плагины
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-56"
          align="start"
          side="bottom"
          :side-offset="4"
        >
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              UI Playground
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem @click="openDSLPlayground">
                DSL
              </DropdownMenuItem>
              <DropdownMenuItem @click="openSFCPlayground">
                SFC
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem @click="openActionPlaygroundsSingleton">
            Action Playgrounds
          </DropdownMenuItem>
          <DropdownMenuItem @click="openBackupRestoreSingleton">
            Резервное восстановление
          </DropdownMenuItem>
          <DropdownMenuItem @click="openUIEditorDemoSingleton">
            UI редактор демо
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Отладка -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="px-2 py-1 rounded-md hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Отладка
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-56"
          align="start"
          side="bottom"
          :side-offset="4"
        >
          <DropdownMenuItem @click="openPulse">
            Пульс
          </DropdownMenuItem>
          <DropdownMenuItem @click="openDomainAnalysis">
            Поиск проблем
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            Компиляция проекта
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Справка -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="px-2 py-1 rounded-md hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title="Endge Framework v1.0"
          >
            Справка
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-56"
          align="start"
          side="bottom"
          :side-offset="4"
        >
          <DropdownMenuLabel class="text-[11px] text-muted-foreground">
            Endge Framework v1.0
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="openArchitecture">
            Архитектура
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  </Teleport>

  <Teleport to="[data-target='grid-layout-header-actions']" defer>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="inline-flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title="Открыть Пульс и Домен"
        @click="openPulseFromHeader"
      >
        <HeartPulse class="size-4 text-rose-500" />
      </button>
      <ActiveUsers_Header />
    </div>
  </Teleport>

  <EditorView />
</template>
