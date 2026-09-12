<script setup lang="ts">
import { Endge } from '@endge/core'
import { AppBus } from '@endge/utils'
import { DatabaseZap, FolderTree, RefreshCcw } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { Configurator } from '@/app/Configurator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import DomainVersionBadge from '@/features/domain-version/ui/DomainVersionBadge.vue'
import { useDomainVersions } from '@/features/domain-version/ui/use-domain-versions'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import { useEndgeIDEContext } from '@/features/endge-ide/services/context/use-endge-ide-context'
import FacetSwitchers from '@/features/endge-ide/ui/context/FacetSwitchers.vue'
import LocaleSwitcher from '@/features/endge-ide/ui/context/LocaleSwitcher.vue'
import ThemeSwitcher from '@/features/endge-ide/ui/context/ThemeSwitcher.vue'
import TimezoneSwitcher from '@/features/endge-ide/ui/context/TimezoneSwitcher.vue'

const props = defineProps<{ readonly?: boolean }>()
const readOnly = computed(() => props.readonly === true)
const isDebugger = Endge.mode === 'debugger'
const { t } = useI18n()

const context = useEndgeIDEContext()
const { state: domainVersionState, refresh: refreshDomainVersion } = useDomainVersions()
const isMockEnabled = computed(() => context.isMockEnabled())
const isDataModeOverridden = computed(() => !isDebugger && context.isDataModeOverridden())
const isChangingDataMode = ref(false)
const mockLabel = 'mock'
const mockModeTitle = computed(() => {
  const source = isDebugger
    ? t('statusBar.sourceClientContext')
    : isDataModeOverridden.value
      ? t('statusBar.sourceConfiguratorOverride')
      : t('statusBar.sourceWorkspaceDefault')
  return isMockEnabled.value
    ? t('statusBar.mockEnabled', { source })
    : t('statusBar.liveEnabled', { source })
})
const activeDocumentStructure = EndgeIDE.uiState.documentStructure
const documentStructureTitle = computed(() => activeDocumentStructure.value === 'custom'
  ? t('statusBar.showFrontendStructure')
  : t('statusBar.showWorkspaceStructure'))
const activeDomainTarget = computed(() => {
  const workspace = Configurator.connections.readWorkspace()
    ?? String(Endge.workspace.current.identity ?? '').trim()
  return workspace
    ? { backendURL: Configurator.connections.activeBackendURL, workspace }
    : null
})
const activeDomainVersionState = computed(() => domainVersionState(activeDomainTarget.value))

function updateDomainVersion(force = false): void {
  if (!isDebugger && !readOnly.value && activeDomainTarget.value) {
    void refreshDomainVersion(activeDomainTarget.value, force)
  }
}

function handleDomainChanged(): void {
  updateDomainVersion(true)
}

async function reloadDomain(): Promise<void> {
  if (isDebugger || readOnly.value) {
    return
  }
  try {
    await context.reloadCurrentContext()
    updateDomainVersion(true)
    toast.success('Домен полностью перезагружен', { description: 'Данные заново загружены с сервера и скомпилированы.' })
  }
  catch (error: any) {
    toast.error('Не удалось перезагрузить домен', { description: String(error?.message ?? error) })
  }
}

async function toggleMockMode(): Promise<void> {
  if (readOnly.value || isChangingDataMode.value || context.isSwitching()) {
    return
  }

  isChangingDataMode.value = true
  try {
    if (isDataModeOverridden.value) {
      await context.clearDataModeOverride()
    }
    else {
      await context.setMockEnabled(!isMockEnabled.value)
    }
    toast.success(context.isMockEnabled() ? 'Mock-данные включены' : 'Live-данные включены', {
      description: isDebugger
        ? 'Команда выполнена на клиенте.'
        : context.isDataModeOverridden()
          ? 'Используется локальное переопределение конфигуратора.'
          : 'Восстановлен режим данных из Workspace.',
    })
  }
  catch (error) {
    toast.error('Не удалось выполнить смену режима данных', {
      description: String(error instanceof Error ? error.message : error),
    })
  }
  finally {
    isChangingDataMode.value = false
  }
}

function toggleDocumentStructure(): void {
  EndgeIDE.uiState.toggleDocumentStructure()
}

onMounted(() => {
  if (isDebugger || readOnly.value) {
    return
  }
  AppBus.onCustom('domainChanged', handleDomainChanged)
  updateDomainVersion()
})

onBeforeUnmount(() => {
  AppBus.offCustom('domainChanged', handleDomainChanged)
})
</script>

<template>
  <footer class="flex h-8 shrink-0 items-center justify-between px-3 text-xs font-medium text-muted-foreground" :aria-label="readOnly ? $t('remoteDebugger.contextReadonly') : undefined">
    <div class="flex min-w-0 items-center gap-1.5 overflow-hidden">
      <div class="footer-context-switchers flex shrink-0 items-center gap-1.5">
        <FacetSwitchers :readonly="readOnly" />
        <LocaleSwitcher :readonly="readOnly" />
        <ThemeSwitcher :readonly="readOnly" />
        <TimezoneSwitcher :readonly="readOnly" />
      </div>
    </div>

    <TooltipProvider v-if="!readOnly" :delay-duration="200">
      <div class="flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger as-child>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-muted/90 disabled:cursor-wait disabled:opacity-50"
              :class="isMockEnabled && 'bg-primary/15 text-primary'"
              :disabled="context.isSwitching() || isChangingDataMode"
              :aria-label="mockModeTitle"
              :aria-pressed="isMockEnabled"
              @click="toggleMockMode"
            >
              <DatabaseZap class="size-3.5 shrink-0" />
              <span>{{ mockLabel }}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" class="max-w-80 text-xs leading-5">
            {{ mockModeTitle }}
          </TooltipContent>
        </Tooltip>
        <DomainVersionBadge v-if="!isDebugger" :state="activeDomainVersionState" prefix />
        <Tooltip v-if="!isDebugger">
          <TooltipTrigger as-child>
            <button
              type="button"
              class="inline-flex items-center rounded-md px-1.5 py-0.5 transition hover:bg-muted/90 disabled:cursor-wait disabled:opacity-50"
              :disabled="context.isSwitching()"
              :aria-label="t('statusBar.reloadDomain')"
              @click="reloadDomain"
            >
              <RefreshCcw class="size-3.5" :class="{ 'animate-spin': context.isSwitching() }" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {{ t('statusBar.reloadDomain') }}
          </TooltipContent>
        </Tooltip>
        <Tooltip v-if="!isDebugger">
          <TooltipTrigger as-child>
            <button
              type="button"
              class="inline-flex items-center rounded-md px-1.5 py-0.5 transition hover:bg-muted/90"
              :class="activeDocumentStructure === 'custom' && 'bg-primary/15 text-primary'"
              :aria-label="documentStructureTitle"
              :aria-pressed="activeDocumentStructure === 'custom'"
              @click="toggleDocumentStructure"
            >
              <FolderTree class="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {{ documentStructureTitle }}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  </footer>
</template>

<style scoped>
.footer-context-switchers :deep([data-slot="button"]),
.footer-context-switchers :deep([data-slot="dropdown-menu-trigger"]) {
  font-size: inherit;
  line-height: inherit;
  font-weight: inherit;
}
</style>
