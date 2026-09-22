<script setup lang="ts">
import type {
  BuildProfileDebuggerStructure,
  BuildProfileDiagnostics,
  BuildProfileSettings,
  BuildProfileVisibility,
  RBuildProfile,
} from '@/features/endge-ide/domain/entities/RBuildProfile'

import {
  FileClock,
  Globe2,
  Hammer,
  Loader2,
  Monitor,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserRound,
} from 'lucide-vue-next'

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger,
} from 'reka-ui'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { Configurator } from '@/app/Configurator'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cloneBuildProfileSettings } from '@/features/endge-ide/domain/entities/RBuildProfile'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import { useConfiguratorState } from '@/shared/tools/use-configurator-state'

type ProfileTab = 'contents' | 'topology'

const PROFILE_LIST_WIDTH_STATE_KEY
  = 'configurator.build-profiles.profile-list-width'
const PROFILE_LIST_DEFAULT_WIDTH = 320
const PROFILE_LIST_MIN_WIDTH = 220
const PROFILE_LIST_MAX_WIDTH = 520
const PROFILE_CONTENT_MIN_WIDTH = 560
const PROFILE_LIST_SPLITTER_WIDTH = 7
const PROFILE_LIST_KEYBOARD_STEP = 16

const module = EndgeIDE.buildProfiles
const openState = ref(false)
const selectedIdentity = ref<'current' | string>('current')
const activeTab = ref<ProfileTab>('contents')
const draftVisibility = ref<BuildProfileVisibility>('private')
const nameDraft = ref('')
const deleteCandidate = ref<RBuildProfile | null>(null)
const isCreating = ref(false)
const isDeleting = ref(false)
const splitContainer = ref<HTMLElement | null>(null)
const splitContainerWidth = ref(0)
const profileListWidth = useConfiguratorState<number>(
  PROFILE_LIST_WIDTH_STATE_KEY,
  PROFILE_LIST_DEFAULT_WIDTH,
)
const profileListWidthDraft = ref(PROFILE_LIST_DEFAULT_WIDTH)
const isProfileListResizing = ref(false)
let profileListResizeStartX = 0
let profileListResizeStartWidth = PROFILE_LIST_DEFAULT_WIDTH

const canWrite = computed(() =>
  ['editor', 'admin'].includes(Configurator.context.workspaceRole ?? ''),
)
const selectedProfile = computed(
  () =>
    module.profiles.value.find(
      profile => profile.identity === selectedIdentity.value,
    ) ?? null,
)
const selectedSettings = computed(
  () => selectedProfile.value?.settings ?? module.draftSettings.value,
)
const sharedProfiles = computed(() =>
  module.profiles.value.filter(profile => profile.visibility === 'shared'),
)
const privateProfiles = computed(() =>
  module.profiles.value.filter(profile => profile.visibility === 'private'),
)
const isBuilding = computed(() =>
  ['building', 'packing'].includes(module.buildStatus.value),
)
const hasUnsavedChanges = computed(() =>
  EndgeIDE.tabs.openTabs.value.some(tab => EndgeIDE.tabs.isTabDirty(tab.id)),
)
async function build(): Promise<void> {
  try {
    await module.buildBundle(selectedSettings.value, selectedProfile.value ?? undefined)
    openState.value = false
  }
  catch (error) {
    toast.error('Не удалось собрать Bundle', { description: errorText(error) })
  }
}
const isLoading = computed(() => module.status.value === 'loading')
const availableProfileListWidth = computed(() => {
  if (!splitContainerWidth.value) {
    return PROFILE_LIST_MAX_WIDTH
  }
  return Math.max(
    PROFILE_LIST_MIN_WIDTH,
    Math.min(
      PROFILE_LIST_MAX_WIDTH,
      splitContainerWidth.value
      - PROFILE_CONTENT_MIN_WIDTH
      - PROFILE_LIST_SPLITTER_WIDTH,
    ),
  )
})
const displayedProfileListWidth = computed(() =>
  clampProfileListWidth(profileListWidthDraft.value),
)

watch(
  selectedProfile,
  (profile) => {
    nameDraft.value = profile?.displayName ?? 'Текущие настройки'
  },
  { immediate: true },
)
watch(profileListWidth, (width) => {
  if (!isProfileListResizing.value) {
    profileListWidthDraft.value = clampProfileListWidth(width)
  }
})
watch(openState, (isOpen) => {
  if (!isOpen) {
    endProfileListResize()
  }
})

async function open(): Promise<void> {
  selectedIdentity.value = 'current'
  activeTab.value = 'contents'
  draftVisibility.value = 'private'
  openState.value = true
  await nextTick()
  syncSplitContainerWidth()
  try {
    await module.load(Configurator.context.workspaceIdentity)
  }
  catch (error) {
    toast.error('Не удалось загрузить профили сборки', {
      description: errorText(error),
    })
  }
}

defineExpose({ open })

function clampProfileListWidth(width: unknown): number {
  const normalized
    = typeof width === 'number' && Number.isFinite(width)
      ? width
      : PROFILE_LIST_DEFAULT_WIDTH
  return Math.round(
    Math.min(
      availableProfileListWidth.value,
      Math.max(PROFILE_LIST_MIN_WIDTH, normalized),
    ),
  )
}

function syncSplitContainerWidth(): void {
  splitContainerWidth.value = splitContainer.value?.clientWidth ?? 0
  if (!isProfileListResizing.value) {
    profileListWidthDraft.value = clampProfileListWidth(profileListWidth.value)
  }
}

function beginProfileListResize(event: PointerEvent): void {
  if (event.button !== 0) {
    return
  }
  event.preventDefault()
  profileListResizeStartX = event.clientX
  profileListResizeStartWidth = displayedProfileListWidth.value
  isProfileListResizing.value = true
  document.body.classList.add('select-none')
  document.body.style.cursor = 'ew-resize'
  window.addEventListener('pointermove', resizeProfileList)
  window.addEventListener('pointerup', endProfileListResize)
  window.addEventListener('pointercancel', endProfileListResize)
}

function resizeProfileList(event: PointerEvent): void {
  if (!isProfileListResizing.value) {
    return
  }
  profileListWidthDraft.value = clampProfileListWidth(
    profileListResizeStartWidth + event.clientX - profileListResizeStartX,
  )
}

function endProfileListResize(): void {
  if (!isProfileListResizing.value) {
    return
  }
  isProfileListResizing.value = false
  profileListWidth.value = displayedProfileListWidth.value
  removeProfileListResizeListeners()
}

function removeProfileListResizeListeners(): void {
  window.removeEventListener('pointermove', resizeProfileList)
  window.removeEventListener('pointerup', endProfileListResize)
  window.removeEventListener('pointercancel', endProfileListResize)
  document.body.classList.remove('select-none')
  document.body.style.cursor = ''
}

function resetProfileListWidth(): void {
  profileListWidthDraft.value = clampProfileListWidth(
    PROFILE_LIST_DEFAULT_WIDTH,
  )
  profileListWidth.value = displayedProfileListWidth.value
}

function resizeProfileListByKeyboard(event: KeyboardEvent): void {
  const step = event.shiftKey
    ? PROFILE_LIST_KEYBOARD_STEP * 2
    : PROFILE_LIST_KEYBOARD_STEP
  let nextWidth: number | null = null
  if (event.key === 'ArrowLeft') {
    nextWidth = displayedProfileListWidth.value - step
  }
  else if (event.key === 'ArrowRight') {
    nextWidth = displayedProfileListWidth.value + step
  }
  else if (event.key === 'Home') {
    nextWidth = PROFILE_LIST_MIN_WIDTH
  }
  else if (event.key === 'End') {
    nextWidth = availableProfileListWidth.value
  }
  if (nextWidth == null) {
    return
  }
  event.preventDefault()
  profileListWidthDraft.value = clampProfileListWidth(nextWidth)
  profileListWidth.value = displayedProfileListWidth.value
}

onMounted(() => window.addEventListener('resize', syncSplitContainerWidth))
onBeforeUnmount(() => {
  endProfileListResize()
  removeProfileListResizeListeners()
  window.removeEventListener('resize', syncSplitContainerWidth)
})

async function saveCurrent(
  visibility: BuildProfileVisibility = draftVisibility.value,
): Promise<void> {
  if (!canWrite.value || isCreating.value) {
    return
  }
  isCreating.value = true
  try {
    const created = await module.create(visibility)
    selectedIdentity.value = created.identity
    toast.success(`Профиль «${created.displayName}» сохранён`)
  }
  catch (error) {
    toast.error('Не удалось сохранить профиль', {
      description: errorText(error),
    })
  }
  finally {
    isCreating.value = false
  }
}

async function updateVisibility(
  value: boolean | 'indeterminate',
): Promise<void> {
  const visibility: BuildProfileVisibility
    = value === true ? 'private' : 'shared'
  const profile = selectedProfile.value
  if (!profile) {
    draftVisibility.value = visibility
    return
  }
  if (!profile.canChangeVisibility || profile.visibility === visibility) {
    return
  }
  try {
    await module.patch(profile, { visibility })
  }
  catch (error) {
    toast.error('Не удалось изменить видимость профиля', {
      description: errorText(error),
    })
  }
}

async function updateSettings(
  patch: Partial<
    Pick<
      BuildProfileSettings,
      'diagnostics' | 'debuggerStructure' | 'includeAst' | 'fileFormat'
    >
  >,
): Promise<void> {
  const settings = cloneBuildProfileSettings(selectedSettings.value)
  Object.assign(settings, patch)
  const profile = selectedProfile.value
  if (!profile) {
    module.draftSettings.value = settings
    return
  }
  if (!profile.canManage) {
    return
  }
  try {
    await module.patch(profile, { settings })
  }
  catch (error) {
    toast.error('Не удалось сохранить настройки профиля', {
      description: errorText(error),
    })
  }
}

async function commitName(): Promise<void> {
  const profile = selectedProfile.value
  const displayName = nameDraft.value.trim()
  if (
    !profile
    || !profile.canManage
    || !displayName
    || displayName === profile.displayName
  ) {
    nameDraft.value = profile?.displayName ?? 'Текущие настройки'
    return
  }
  try {
    await module.patch(profile, { displayName })
    nameDraft.value = profile.displayName
  }
  catch (error) {
    nameDraft.value = profile.displayName
    toast.error('Не удалось переименовать профиль', {
      description: errorText(error),
    })
  }
}

function focusName(profile: RBuildProfile): void {
  selectedIdentity.value = profile.identity
  void nextTick(() => {
    const input = document.querySelector<HTMLInputElement>(
      '[data-build-profile-name]',
    )
    input?.focus()
    input?.select()
  })
}

async function confirmDelete(): Promise<void> {
  const profile = deleteCandidate.value
  if (!profile || isDeleting.value) {
    return
  }
  isDeleting.value = true
  try {
    await module.delete(profile)
    if (selectedIdentity.value === profile.identity) {
      selectedIdentity.value = 'current'
    }
    deleteCandidate.value = null
    toast.success(`Профиль «${profile.displayName}» удалён`)
  }
  catch (error) {
    toast.error('Не удалось удалить профиль', {
      description: errorText(error),
    })
  }
  finally {
    isDeleting.value = false
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const diagnosticsOptions: Array<{
  value: BuildProfileDiagnostics
  label: string
}> = [
  { value: 'minimal', label: 'Минимальные' },
  { value: 'standard', label: 'Стандартные' },
  { value: 'detailed', label: 'Подробные' },
]
const debuggerOptions: Array<{
  value: BuildProfileDebuggerStructure
  label: string
}> = [
  { value: 'complete-catalog', label: 'Полный каталог' },
  { value: 'extended-catalog', label: 'Расширенный каталог' },
]
const copy = {
  title: 'Профили сборки',
  description:
    'Управление личными и общими профилями сборки текущего Workspace.',
  currentGroup: 'Текущие',
  current: 'Текущие настройки',
  savePrivate: 'Сохранить в личные',
  saveShared: 'Сохранить в общие',
  sharedGroup: 'Общие профили',
  privateGroup: 'Личные профили',
  loading: 'Загрузка…',
  rename: 'Переименовать',
  delete: 'Удалить',
  personal: 'Личный профиль',
  contents: 'Содержимое',
  topology: 'Топология',
  buildScope: 'Область сборки',
  completeModel: 'Вся модель',
  contexts: 'Контексты',
  allContexts: 'Текущий effective context',
  diagnostics: 'Диагностика',
  debugger: 'Структура для Debugger',
  node: 'Узел',
  runtime: 'Runtime',
  frontend: 'Frontend',
  runtimeFamily: 'ts-browser',
  addNode: 'Добавить узел',
  save: 'Сохранить профиль',
  build: 'Собрать и скачать',
  close: 'Закрыть',
  deleteTitle: 'Удалить профиль?',
  cancel: 'Отмена',
}
const deleteDescription = computed(
  () =>
    `Профиль «${deleteCandidate.value?.displayName ?? ''}» будет удалён без возможности восстановления.`,
)
const { t } = useI18n()
</script>

<template>
  <Dialog v-model:open="openState">
    <DialogContent
      class="execution-bundle-profiles-dialog h-[720px] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-hidden border-border p-0 shadow-2xl sm:max-w-[1280px]"
    >
      <div
        class="grid h-full min-h-0"
        style="grid-template-rows: auto minmax(0, 1fr) auto"
      >
        <DialogHeader class="border-b bg-muted/20 px-4 py-3 text-left">
          <DialogTitle class="text-sm font-medium tracking-tight">
            {{ copy.title }}
          </DialogTitle>
          <DialogDescription class="sr-only">
            {{ copy.description }}
          </DialogDescription>
        </DialogHeader>

        <div ref="splitContainer" class="flex min-h-0 overflow-hidden">
          <aside
            class="grid min-h-0 shrink-0 bg-muted/10"
            :style="{
              width: `${displayedProfileListWidth}px`,
              flexBasis: `${displayedProfileListWidth}px`,
              gridTemplateRows: 'auto minmax(0, 1fr)',
            }"
          >
            <div class="flex h-9 items-center gap-0.5 border-b px-1.5">
              <Button
                variant="ghost"
                size="icon-sm"
                :disabled="!canWrite || isCreating"
                title="Сохранить текущие настройки"
                @click="saveCurrent()"
              >
                <Loader2 v-if="isCreating" class="size-3.5 animate-spin" />
                <Plus v-else class="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                :disabled="!selectedProfile?.canManage"
                title="Удалить профиль"
                @click="deleteCandidate = selectedProfile"
              >
                <Trash2 class="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                :disabled="!selectedProfile?.canManage"
                title="Переименовать профиль"
                @click="selectedProfile && focusName(selectedProfile)"
              >
                <Pencil class="size-3.5" />
              </Button>
            </div>

            <ScrollArea class="min-h-0">
              <div class="space-y-3 p-2">
                <section>
                  <p
                    class="mb-1 px-2 text-[10px] font-medium text-muted-foreground"
                  >
                    {{ copy.currentGroup }}
                  </p>
                  <ContextMenuRoot>
                    <ContextMenuTrigger as-child>
                      <button
                        type="button"
                        class="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        :class="
                          selectedIdentity === 'current'
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                        "
                        @click="selectedIdentity = 'current'"
                      >
                        <FileClock class="size-3.5 shrink-0 text-amber-500" />
                        <span class="truncate">{{ copy.current }}</span>
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuPortal>
                      <ContextMenuContent
                        class="z-[10001] min-w-52 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                      >
                        <ContextMenuItem
                          class="context-item"
                          :disabled="!canWrite"
                          @select="saveCurrent('private')"
                        >
                          <UserRound class="size-3.5 text-emerald-500" />
                          {{ copy.savePrivate }}
                        </ContextMenuItem>
                        <ContextMenuItem
                          class="context-item"
                          :disabled="!canWrite"
                          @select="saveCurrent('shared')"
                        >
                          <Globe2 class="size-3.5 text-sky-500" />
                          {{ copy.saveShared }}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenuPortal>
                  </ContextMenuRoot>
                </section>

                <section>
                  <p
                    class="mb-1 px-2 text-[10px] font-medium text-muted-foreground"
                  >
                    {{ copy.sharedGroup }}
                  </p>
                  <p
                    v-if="isLoading"
                    class="px-2 py-2 text-xs text-muted-foreground"
                  >
                    {{ copy.loading }}
                  </p>
                  <ContextMenuRoot
                    v-for="profile in sharedProfiles"
                    :key="profile.identity"
                  >
                    <ContextMenuTrigger as-child>
                      <button
                        type="button"
                        class="profile-row"
                        :class="
                          selectedIdentity === profile.identity
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                        "
                        @click="selectedIdentity = profile.identity"
                      >
                        <Globe2 class="size-3.5 shrink-0 text-sky-500" /><span
                          class="truncate"
                        >{{ profile.displayName }}</span>
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuPortal>
                      <ContextMenuContent class="context-content">
                        <ContextMenuItem
                          class="context-item"
                          :disabled="!profile.canManage"
                          @select="focusName(profile)"
                        >
                          <Pencil class="size-3.5" /> {{ copy.rename }}
                        </ContextMenuItem>
                        <ContextMenuItem
                          class="context-item text-destructive"
                          :disabled="!profile.canManage"
                          @select="deleteCandidate = profile"
                        >
                          <Trash2 class="size-3.5" /> {{ copy.delete }}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenuPortal>
                  </ContextMenuRoot>
                </section>

                <section>
                  <p
                    class="mb-1 px-2 text-[10px] font-medium text-muted-foreground"
                  >
                    {{ copy.privateGroup }}
                  </p>
                  <ContextMenuRoot
                    v-for="profile in privateProfiles"
                    :key="profile.identity"
                  >
                    <ContextMenuTrigger as-child>
                      <button
                        type="button"
                        class="profile-row"
                        :class="
                          selectedIdentity === profile.identity
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                        "
                        @click="selectedIdentity = profile.identity"
                      >
                        <UserRound
                          class="size-3.5 shrink-0 text-emerald-500"
                        /><span class="truncate">{{
                          profile.displayName
                        }}</span>
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuPortal>
                      <ContextMenuContent class="context-content">
                        <ContextMenuItem
                          class="context-item"
                          :disabled="!profile.canManage"
                          @select="focusName(profile)"
                        >
                          <Pencil class="size-3.5" /> {{ copy.rename }}
                        </ContextMenuItem>
                        <ContextMenuItem
                          class="context-item text-destructive"
                          :disabled="!profile.canManage"
                          @select="deleteCandidate = profile"
                        >
                          <Trash2 class="size-3.5" /> {{ copy.delete }}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenuPortal>
                  </ContextMenuRoot>
                </section>
              </div>
            </ScrollArea>
          </aside>

          <div
            class="profile-list-splitter"
            :data-resizing="isProfileListResizing"
            role="separator"
            aria-label="Изменить ширину списка профилей сборки"
            aria-orientation="vertical"
            :aria-valuenow="displayedProfileListWidth"
            :aria-valuemin="PROFILE_LIST_MIN_WIDTH"
            :aria-valuemax="availableProfileListWidth"
            tabindex="0"
            title="Перетащите для изменения ширины. Двойной клик — ширина по умолчанию."
            @dblclick="resetProfileListWidth"
            @pointerdown="beginProfileListResize"
            @keydown="resizeProfileListByKeyboard"
          >
            <span />
          </div>

          <Tabs
            v-model="activeTab"
            class="grid min-h-0 min-w-0 flex-1 bg-background"
            style="grid-template-rows: auto auto minmax(0, 1fr)"
          >
            <div class="flex h-12 items-center gap-3 border-b px-4">
              <Hammer class="size-4 shrink-0 text-amber-500" />
              <Input
                v-if="selectedProfile"
                v-model="nameDraft"
                data-build-profile-name
                class="h-8 max-w-md border-transparent bg-transparent px-1 text-sm font-medium shadow-none hover:border-input focus-visible:border-input"
                :disabled="!selectedProfile.canManage"
                maxlength="160"
                @blur="commitName"
                @keydown.enter.prevent="
                  ($event.currentTarget as HTMLInputElement).blur()
                "
              />
              <span v-else class="truncate text-sm font-medium">{{
                copy.current
              }}</span>
              <label
                class="ml-auto flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Checkbox
                  :model-value="
                    selectedProfile
                      ? selectedProfile.visibility === 'private'
                      : draftVisibility === 'private'
                  "
                  :disabled="
                    selectedProfile
                      ? !selectedProfile.canChangeVisibility
                      : !canWrite
                  "
                  @update:model-value="updateVisibility"
                />
                {{ copy.personal }}
              </label>
            </div>

            <TabsList
              class="h-9 w-full justify-start rounded-none border-b bg-transparent px-3 py-0"
            >
              <TabsTrigger value="contents" class="profile-tab">
                {{ copy.contents }}
              </TabsTrigger>
              <TabsTrigger value="topology" class="profile-tab">
                {{ copy.topology }}
              </TabsTrigger>
            </TabsList>

            <ScrollArea class="min-h-0">
              <TabsContent value="contents" class="m-0 p-5">
                <div class="grid max-w-2xl grid-cols-2 gap-x-5 gap-y-7">
                  <div class="space-y-2">
                    <label class="block text-xs text-muted-foreground">{{
                      copy.buildScope
                    }}</label><Select model-value="complete-model" disabled>
                      <SelectTrigger size="sm" class="w-full">
                        <SelectValue />
                      </SelectTrigger><SelectContent>
                        <SelectItem value="complete-model">
                          {{ copy.completeModel }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="space-y-2">
                    <label class="block text-xs text-muted-foreground">{{
                      copy.contexts
                    }}</label><Select model-value="all-contexts" disabled>
                      <SelectTrigger size="sm" class="w-full">
                        <SelectValue />
                      </SelectTrigger><SelectContent>
                        <SelectItem value="all-contexts">
                          {{ copy.allContexts }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="space-y-2">
                    <label class="block text-xs text-muted-foreground">{{
                      copy.diagnostics
                    }}</label>
                    <Select
                      :model-value="selectedSettings.diagnostics"
                      disabled
                      @update:model-value="
                        (value) =>
                          updateSettings({
                            diagnostics: value as BuildProfileDiagnostics,
                          })
                      "
                    >
                      <SelectTrigger size="sm" class="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="option in diagnosticsOptions"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="space-y-2">
                    <label class="block text-xs text-muted-foreground">{{
                      copy.debugger
                    }}</label>
                    <Select
                      :model-value="selectedSettings.debuggerStructure"
                      disabled
                      @update:model-value="
                        (value) =>
                          updateSettings({
                            debuggerStructure:
                              value as BuildProfileDebuggerStructure,
                          })
                      "
                    >
                      <SelectTrigger size="sm" class="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="option in debuggerOptions"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="col-span-2 text-xs text-muted-foreground">
                    {{ t('bundleInspection.inactiveSettings') }}
                  </div>
                  <div class="space-y-2">
                    <label class="block text-xs text-muted-foreground"> {{ t('bundleInspection.fileFormat') }} </label>
                    <Select
                      :model-value="selectedSettings.fileFormat"
                      :disabled="
                        isBuilding
                          || (!!selectedProfile && !selectedProfile.canManage)
                      "
                      @update:model-value="
                        (value) =>
                          updateSettings({
                            fileFormat: value as 'gzip' | 'json',
                          })
                      "
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gzip">
                          {{ t('bundleInspection.gzipFormat') }}
                        </SelectItem><SelectItem value="json">
                          {{ t('bundleInspection.jsonFormat') }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="space-y-2">
                    <label class="flex items-center gap-2 text-sm"><Checkbox
                      :model-value="selectedSettings.includeAst"
                      :disabled="
                        isBuilding
                          || (!!selectedProfile && !selectedProfile.canManage)
                      "
                      @update:model-value="
                        (value) =>
                          updateSettings({ includeAst: value === true })
                      "
                    /> {{ t('bundleInspection.includeAst') }} </label>
                    <p class="text-xs text-muted-foreground">
                      {{ t('bundleInspection.astHelp') }}
                    </p>
                  </div>
                  <p
                    v-if="hasUnsavedChanges"
                    class="col-span-2 text-xs text-amber-600"
                    role="status"
                  >
                    {{ t('bundleInspection.unsaved') }}
                  </p>
                  <p
                    v-if="module.buildStatus.value !== 'idle'"
                    class="col-span-2 text-xs"
                    role="status"
                  >
                    {{
                      {
                        building: "Сборка…",
                        packing: "Упаковка…",
                        ready: "Файл готов",
                        error: module.buildError.value,
                      }[
                        module.buildStatus.value as
                          "building" | "packing" | "ready" | "error"
                      ]
                    }}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="topology" class="m-0 p-5">
                <div class="max-w-2xl">
                  <div class="overflow-hidden rounded-md border">
                    <table class="w-full text-xs">
                      <thead class="bg-muted/35 text-muted-foreground">
                        <tr>
                          <th
                            scope="col"
                            class="px-3 py-2 text-left font-medium"
                          >
                            {{ copy.node }}
                          </th>
                          <th
                            scope="col"
                            class="w-44 px-3 py-2 text-left font-medium"
                          >
                            {{ copy.runtime }}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr class="border-t">
                          <td class="px-3 py-2.5">
                            <span class="flex items-center gap-2"><Monitor class="size-3.5 text-sky-500" />{{
                              copy.frontend
                            }}</span>
                          </td>
                          <td
                            class="px-3 py-2.5 font-mono text-[10px] text-muted-foreground"
                          >
                            {{ copy.runtimeFamily }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    class="mt-3"
                    disabled
                  >
                    <Plus class="size-3.5" />{{ copy.addNode }}
                  </Button>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>

        <DialogFooter class="border-t bg-muted/15 px-4 py-2.5">
          <Button
            v-if="!selectedProfile && canWrite"
            variant="outline"
            :disabled="isCreating"
            @click="saveCurrent()"
          >
            <Loader2 v-if="isCreating" class="size-3.5 animate-spin" /><Save
              v-else
              class="size-3.5"
            />{{ copy.save }}
          </Button>
          <Button :disabled="isBuilding" class="min-w-24" @click="build">
            <Hammer class="size-3.5" />{{ copy.build }}
          </Button>
          <Button variant="outline" @click="openState = false">
            {{ copy.close }}
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>

  <AlertDialog
    :open="!!deleteCandidate"
    @update:open="(value) => !value && (deleteCandidate = null)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ copy.deleteTitle }}</AlertDialogTitle><AlertDialogDescription>
          {{
            deleteDescription
          }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="isDeleting">
          {{ copy.cancel }}
        </AlertDialogCancel><Button
          type="button"
          variant="destructive"
          :disabled="isDeleting"
          @click="confirmDelete"
        >
          <Loader2 v-if="isDeleting" class="size-4 animate-spin" />{{
            copy.delete
          }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<style scoped>
@reference "@/assets/main.css";

.profile-row {
  @apply flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring;
}
.profile-tab {
  @apply h-9 flex-none rounded-none border-b-2 border-transparent px-3 text-xs shadow-none;
}
.profile-tab[data-state="active"] {
  border-color: transparent;
  border-bottom-color: var(--primary);
  background: transparent;
  box-shadow: none;
}
.context-content {
  @apply z-[10001] min-w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md;
}
.context-item {
  @apply flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground;
}

.profile-list-splitter {
  position: relative;
  z-index: 2;
  display: flex;
  width: 7px;
  min-height: 0;
  flex: 0 0 7px;
  align-items: center;
  justify-content: center;
  border-right: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  border-left: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  background: color-mix(in srgb, var(--muted) 30%, transparent);
  cursor: ew-resize;
  outline: none;
  touch-action: none;
}

.profile-list-splitter span {
  width: 2px;
  height: 30px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--muted-foreground) 34%, transparent);
  transition:
    height 120ms ease,
    background-color 120ms ease;
}

.profile-list-splitter:hover span,
.profile-list-splitter:focus-visible span,
.profile-list-splitter[data-resizing="true"] span {
  height: 46px;
  background: var(--primary);
}
</style>
