<script setup lang="ts">
import type { RegisteredConfiguratorMenuItem } from '@/features/endge-ide/modules/integrations/ConfiguratorMenuRegistry'

import { Endge } from '@endge/core'
import { ArrowUpRight, BookOpen, Bot, Boxes, Download, Loader2, Play, Settings2, ShieldCheck, Upload } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { Configurator } from '@/app/Configurator'
import { getIconComponent, toggleWidget } from '@/app/ui/layouts/grid'
import { canManageAccess as canManageAccessPolicy } from '@/features/access-control'
import AccessControl_Modal from '@/features/access-control/ui/AccessControl_Modal.vue'
import { AIWorkbench } from '@/features/ai-assistant'
import AIManagement_Modal from '@/features/ai-assistant/ui/AIManagement_Modal.vue'
import { ServiceVersionsDialog } from '@/features/backend-connections'
import BackendConnections_Modal from '@/features/backend-connections/ui/BackendConnections_Modal.vue'
import { ENDGE_IDE_DOCUMENTATION_URL } from '@/features/endge-ide/config/documentation.config'
import { ENDGE_IDE_PROBLEMS_WIDGET_ID } from '@/features/endge-ide/domain/types/problems-workspace.types'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import { useEndgeIDEContext } from '@/features/endge-ide/services/context/use-endge-ide-context'
import DomainImport_Modal from '@/features/endge-ide/ui/modals/DomainImport_Modal.vue'
import RuntimePreviewAuthDialog from '@/features/endge-ide/ui/section/runtime-preview/RuntimePreviewAuthDialog.vue'
import EndgeIDEStatusBar from '@/features/endge-ide/ui/shell/EndgeIDEStatusBar.vue'
import EditorView from '@/features/endge-ide/ui/views/Editor_View.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

const tabs = EndgeIDE.tabs
const context = useEndgeIDEContext()
const { t } = useI18n()
const configuratorMenuItems = EndgeIDE.integrations.menuItems
const isBusy = computed(() => EndgeIDE.busy.value)
const canImportDomain = computed(() => Configurator.context.workspaceRole === 'admin')
const currentProjectIdentity = computed(() =>
  String(context.currentContext().projectIdentity ?? '').trim(),
)
const isLaunchingProjectRuntime = ref(false)
const domainImportModal = ref<InstanceType<typeof DomainImport_Modal> | null>(null)
const backendConnectionsModal = ref<InstanceType<typeof BackendConnections_Modal> | null>(null)
const accessControlModal = ref<InstanceType<typeof AccessControl_Modal> | null>(null)
const aiManagementModal = ref<InstanceType<typeof AIManagement_Modal> | null>(null)
const serviceVersionsDialog = ref<InstanceType<typeof ServiceVersionsDialog> | null>(null)
const canConfigureAI = computed(() => {
  if (Configurator.session.state.status !== 'authenticated') {
    return false
  }
  return Configurator.session.state.session.platformAdmin
    || ['viewer', 'editor', 'admin'].includes(Configurator.context.workspaceRole ?? '')
})
const canManageAccess = computed(() => {
  const state = Configurator.session.state
  return canManageAccessPolicy(
    state.status === 'authenticated' && state.session.platformAdmin,
    Configurator.context.workspaceRole ?? '',
  )
})
const launchProjectRuntimeTitle = computed(() =>
  currentProjectIdentity.value
    ? `Запустить Runtime Preview проекта «${currentProjectIdentity.value}»`
    : 'Выберите проект в нижней панели',
)

async function exportCurrentDomain(): Promise<void> {
  await EndgeIDE.domainTransfer.downloadExport(Endge.workspace.current.identity)
}

function openDomainImport(): void {
  void domainImportModal.value?.open()
}

function openBackendConnections(): void {
  backendConnectionsModal.value?.open()
}

function openAccessControl(): void {
  accessControlModal.value?.open()
}

function openAIManagement(): void {
  void aiManagementModal.value?.open()
}

function openServiceVersions(): void {
  serviceVersionsDialog.value?.open()
}

onMounted(() => {
  void AIWorkbench.init(Configurator.context.backendConfig!.serviceBackendURL, Configurator.context.workspaceIdentity)
})

onBeforeUnmount(() => AIWorkbench.reset())

function openDSLPlayground(): void {
  tabs.openDSLPlayground()
}

function openSFCPlayground(): void {
  tabs.openSFCPlayground()
}

function toggleProblems(): void {
  toggleWidget(ENDGE_IDE_PROBLEMS_WIDGET_ID)
}

async function launchCurrentProjectRuntime(): Promise<void> {
  const identity = currentProjectIdentity.value
  if (!identity || context.isSwitching() || isLaunchingProjectRuntime.value) {
    return
  }

  isLaunchingProjectRuntime.value = true
  try {
    const launched = await EndgeIDE.runtimePreview.launch({
      entityType: 'project',
      identity,
    })
    if (launched) {
      EndgeIDE.runtimePreview.requestTreeExpansion('project-compositions')
    }
  }
  finally {
    isLaunchingProjectRuntime.value = false
  }
}

async function runIntegrationMenuAction(entry: RegisteredConfiguratorMenuItem): Promise<void> {
  try {
    await entry.item.action?.()
  }
  catch (error) {
    console.error(`[EndgeIDEIntegrations] Menu action "${entry.id}" failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}
</script>

<template>
  <Teleport to="[data-target='grid-layout-status-bar']" defer>
    <EndgeIDEStatusBar />
  </Teleport>

  <Teleport to="[data-target='grid-layout-header-menu']" defer>
    <nav class="flex items-center gap-1 text-xs font-medium">
      <!-- Схема / документ -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="px-2 py-1 rounded-md hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {{ t('endgeIde.headerMenu.file.title') }}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-56"
          align="start"
          side="bottom"
          :side-offset="4"
        >
          <DropdownMenuItem @click="exportCurrentDomain">
            <Download class="size-3.5" />
            {{ t('endgeIde.headerMenu.file.export') }}
          </DropdownMenuItem>
          <DropdownMenuItem :disabled="isBusy || !canImportDomain" @click="openDomainImport">
            <Upload class="size-3.5" />
            {{ canImportDomain ? t('endgeIde.headerMenu.file.import') : t('endgeIde.headerMenu.file.importWorkspaceAdmin') }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="openBackendConnections">
            <Settings2 class="size-3.5" />
            {{ t('endgeIde.headerMenu.file.connections') }}
          </DropdownMenuItem>
          <DropdownMenuItem v-if="canManageAccess" @click="openAccessControl">
            <ShieldCheck class="size-3.5" />
            {{ t('endgeIde.headerMenu.file.access') }}
          </DropdownMenuItem>
          <DropdownMenuItem v-if="canConfigureAI" @click="openAIManagement">
            <Bot class="size-3.5 text-fuchsia-500" />
            {{ t('endgeIde.headerMenu.file.aiSettings') }}
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
            {{ t('endgeIde.headerMenu.debug.title') }}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-56"
          align="start"
          side="bottom"
          :side-offset="4"
        >
          <DropdownMenuItem @click="toggleProblems">
            {{ t('endgeIde.headerMenu.debug.problems') }}
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            {{ t('endgeIde.headerMenu.debug.projectCompilation') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Дополнительно -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="px-2 py-1 rounded-md hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {{ t('endgeIde.headerMenu.additional.title') }}
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
              {{ t('endgeIde.headerMenu.additional.uiPlayground') }}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem @click="openDSLPlayground">
                {{ t('endgeIde.headerMenu.additional.dsl') }}
              </DropdownMenuItem>
              <DropdownMenuItem @click="openSFCPlayground">
                {{ t('endgeIde.headerMenu.additional.sfc') }}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Помощь -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="px-2 py-1 rounded-md hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {{ t('help.title') }}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-56"
          align="start"
          side="bottom"
          :side-offset="4"
        >
          <DropdownMenuItem
            v-if="ENDGE_IDE_DOCUMENTATION_URL"
            as="a"
            :href="ENDGE_IDE_DOCUMENTATION_URL"
            target="_blank"
            rel="noopener noreferrer"
          >
            <BookOpen class="size-3.5" />
            {{ t('help.documentation') }}
            <ArrowUpRight class="ml-auto size-3.5 opacity-50" />
          </DropdownMenuItem>
          <DropdownMenuSeparator v-if="ENDGE_IDE_DOCUMENTATION_URL" />
          <DropdownMenuItem @click="openServiceVersions">
            <Boxes class="size-3.5" />
            {{ t('help.serviceVersions.menu') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <span
        v-if="configuratorMenuItems.length"
        class="mx-1 h-4 w-px bg-border"
        aria-hidden="true"
      />
      <button
        v-for="entry in configuratorMenuItems"
        :key="entry.id"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        :disabled="!entry.item.action"
        :title="`${entry.item.title} · ${entry.integrationIdentity}`"
        @click="runIntegrationMenuAction(entry)"
      >
        <component
          :is="getIconComponent(entry.item.icon)"
          v-if="getIconComponent(entry.item.icon)"
          class="size-3.5"
        />
        {{ entry.item.title }}
      </button>
    </nav>
  </Teleport>

  <Teleport to="[data-target='grid-layout-header-actions']" defer>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="inline-flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-wait disabled:opacity-50"
        :disabled="!currentProjectIdentity || context.isSwitching() || isLaunchingProjectRuntime"
        :title="launchProjectRuntimeTitle"
        aria-label="Запустить Runtime Preview текущего проекта"
        @click="launchCurrentProjectRuntime"
      >
        <Loader2 v-if="isLaunchingProjectRuntime" class="size-4 animate-spin" />
        <Play v-else class="size-4 text-emerald-500" />
      </button>
    </div>
  </Teleport>

  <EditorView />
  <DomainImport_Modal ref="domainImportModal" />
  <BackendConnections_Modal ref="backendConnectionsModal" />
  <AccessControl_Modal ref="accessControlModal" />
  <AIManagement_Modal ref="aiManagementModal" />
  <ServiceVersionsDialog ref="serviceVersionsDialog" />
  <RuntimePreviewAuthDialog />
</template>
