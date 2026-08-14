<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type {
  ConfiguratorCommit,
  ConfiguratorRelease,
  ConfiguratorRestorePlan,
  ConfiguratorVersionActor,
} from '@/features/configurator-releases/domain/types/configurator-release.type'

import {
  AlertTriangle,
  Check,
  Download,
  GitCommitHorizontal,
  History,
  Loader2,
  Plus,
  RotateCcw,
  Tag,
  Users,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Configurator } from '@/app'
import { Badge } from '@/components/ui/badge'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { configuratorReleases } from '@/features/configurator-releases'
import { ConfiguratorVersionsError } from '@/features/configurator-releases/model/ConfiguratorReleases_Service'

type VersionTab = 'commits' | 'releases'
interface RestoreTarget {
  kind: 'commit' | 'release'
  id: string
  title: string
}

const stateVersion = ref(0)
const activeTab = ref<VersionTab>('commits')
const commitMessage = ref('')
const commitMessageTouched = ref(false)
const releaseName = ref('')
const releaseNameTouched = ref(false)
const commitDetailsOpen = ref(false)
const commitDetails = ref<ConfiguratorCommit | null>(null)
const restoreDialogOpen = ref(false)
const restoreTarget = ref<RestoreTarget | null>(null)
const restorePlan = ref<ConfiguratorRestorePlan | null>(null)

const role = computed(() => Configurator.context.workspaceRole)
const canWrite = computed(
  () => role.value === 'editor' || role.value === 'admin',
)
const canRestore = computed(() => role.value === 'admin')
const releases = computed(() => {
  void stateVersion.value
  return configuratorReleases.releases
})
const commits = computed(() => {
  void stateVersion.value
  return configuratorReleases.commits
})
const commitPlan = computed(() => {
  void stateVersion.value
  return configuratorReleases.commitPlan
})
const loading = computed(() => {
  void stateVersion.value
  return configuratorReleases.loading
})
const hasPendingRevisions = computed(
  () => Number(commitPlan.value?.revisionCount || 0) > 0,
)
const latestCommit = computed(
  () =>
    [...commits.value].sort(
      (left, right) => right.headSequence - left.headSequence,
    )[0] ?? null,
)
const currentCommitId = computed(() => {
  if (hasPendingRevisions.value || !commitPlan.value) {
    return null
  }
  return (
    commits.value.find(
      commit => commit.headSequence === commitPlan.value?.headSequence,
    )?.id ?? null
  )
})
const releasesByCommit = computed(() => {
  const result = new Map<string, ConfiguratorRelease[]>()
  for (const release of releases.value) {
    const items = result.get(release.sourceCommitId) ?? []
    items.push(release)
    result.set(release.sourceCommitId, items)
  }
  return result
})
const commitMessageError = computed(() => {
  if (!commitMessageTouched.value) {
    return ''
  }
  if (!commitMessage.value.trim()) {
    return 'Введите сообщение коммита'
  }
  if (commitMessage.value.trim().length > 1000) {
    return 'Сообщение не должно превышать 1000 символов'
  }
  return ''
})
const releaseNameError = computed(() => {
  if (!releaseNameTouched.value) {
    return ''
  }
  const value = releaseName.value.trim()
  if (!value) {
    return 'Введите название релиза'
  }
  if (value.length > 160) {
    return 'Название не должно превышать 160 символов'
  }
  if (value === 'last') {
    return 'Название «last» зарезервировано'
  }
  return ''
})
const restoreChanges = computed(() => {
  const plan = restorePlan.value
  return plan ? plan.creates + plan.updates + plan.restores + plan.deletes : 0
})

const stop = configuratorReleases.subscribe(() => {
  stateVersion.value += 1
})

async function loadVersions(): Promise<void> {
  try {
    await configuratorReleases.load()
  }
  catch (error) {
    toast.error(errorMessage(error, 'Не удалось загрузить версии'))
  }
}

async function createCommit(): Promise<void> {
  commitMessageTouched.value = true
  if (commitMessageError.value || !hasPendingRevisions.value) {
    return
  }
  try {
    const message = commitMessage.value.trim()
    await configuratorReleases.createCommit(message)
    commitMessage.value = ''
    commitMessageTouched.value = false
    toast.success('Коммит создан', { description: message })
  }
  catch (error) {
    toast.error(errorMessage(error, 'Не удалось создать коммит'))
  }
}

async function createRelease(): Promise<void> {
  releaseNameTouched.value = true
  if (releaseNameError.value) {
    return
  }
  if (hasPendingRevisions.value || !latestCommit.value) {
    activeTab.value = 'commits'
    toast.error('Сначала зафиксируйте текущие изменения')
    return
  }
  try {
    const identity = releaseName.value.trim()
    await configuratorReleases.createRelease(identity, latestCommit.value.id)
    releaseName.value = ''
    releaseNameTouched.value = false
    toast.success('Релиз создан', { description: identity })
  }
  catch (error) {
    toast.error(errorMessage(error, 'Не удалось создать релиз'))
  }
}

async function downloadRelease(identity: string): Promise<void> {
  try {
    await configuratorReleases.download(identity)
  }
  catch (error) {
    toast.error(errorMessage(error, 'Не удалось скачать релиз'))
  }
}

async function openCommitDetails(commit: ConfiguratorCommit): Promise<void> {
  try {
    commitDetails.value = await configuratorReleases.getCommitDiff(commit.id)
    commitDetailsOpen.value = true
  }
  catch (error) {
    toast.error(errorMessage(error, 'Не удалось загрузить состав коммита'))
  }
}

async function requestRestore(target: RestoreTarget): Promise<void> {
  if (!canRestore.value) {
    return
  }
  if (hasPendingRevisions.value) {
    activeTab.value = 'commits'
    toast.error('Перед восстановлением создайте коммит текущих изменений')
    return
  }
  try {
    const plan
      = target.kind === 'commit'
        ? await configuratorReleases.planCommitRestore(target.id)
        : await configuratorReleases.planReleaseRestore(target.id)
    restoreTarget.value = target
    restorePlan.value = plan
    restoreDialogOpen.value = true
  }
  catch (error) {
    toast.error(errorMessage(error, 'Не удалось подготовить восстановление'))
  }
}

async function confirmRestore(): Promise<void> {
  const target = restoreTarget.value
  const plan = restorePlan.value
  if (!target || !plan) {
    return
  }
  try {
    if (target.kind === 'commit') {
      await configuratorReleases.restoreCommit(
        target.id,
        plan.expectedHeadSequence,
      )
    }
    else {
      await configuratorReleases.restoreRelease(
        target.id,
        plan.expectedHeadSequence,
      )
    }

    restoreDialogOpen.value = false
    toast.success('Версия восстановлена', {
      description: 'Создан новый коммит восстановления',
    })
    await Configurator.context.reloadCurrentContext()
  }
  catch (error) {
    toast.error(errorMessage(error, 'Не удалось восстановить версию'))
  }
}

function isCurrentCommit(commit: ConfiguratorCommit): boolean {
  return currentCommitId.value === commit.id
}

function isBaseCommit(commit: ConfiguratorCommit): boolean {
  return hasPendingRevisions.value && latestCommit.value?.id === commit.id
}

function isCurrentRelease(release: ConfiguratorRelease): boolean {
  return (
    !hasPendingRevisions.value
    && release.headSequence === commitPlan.value?.headSequence
  )
}

function actorName(actor: ConfiguratorVersionActor): string {
  return actor.displayName || actor.username || 'Системный пользователь'
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'дата неизвестна'
  }
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function operationLabel(operation: string): string {
  return (
    (
      {
        bootstrap: 'Начальное состояние',
        commit_restore: 'Восстановление коммита',
        import: 'Импорт',
        release_restore: 'Восстановление релиза',
        user: 'Коммит',
      } as Record<string, string>
    )[operation] || operation
  )
}

function shortId(id: string): string {
  return id.slice(0, 8)
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ConfiguratorVersionsError) {
    if (error.code === 'pending_revisions_must_be_committed') {
      return 'Сначала создайте коммит текущих изменений'
    }
    if (error.code === 'head_sequence_conflict') {
      return 'Workspace изменился. Обновите список и повторите действие'
    }
    if (error.code === 'nothing_to_restore') {
      return 'Workspace уже соответствует выбранной версии'
    }
  }
  return error instanceof Error ? error.message : fallback
}

onMounted(() => {
  void loadVersions()
})
onBeforeUnmount(stop)
</script>

<template>
  <TooltipProvider :delay-duration="250">
    <Tabs
      v-model="activeTab"
      class="flex h-full min-h-0 flex-col bg-background"
    >
      <TabsList
        class="grid h-10 w-full shrink-0 grid-cols-2 rounded-none border-b bg-muted/20 p-1"
      >
        <TabsTrigger value="commits" class="rounded-sm text-xs">
          <GitCommitHorizontal class="size-3.5" />
          Коммиты
          <span
            v-if="hasPendingRevisions"
            class="size-1.5 rounded-full bg-amber-500"
          />
        </TabsTrigger>
        <TabsTrigger value="releases" class="rounded-sm text-xs">
          <Tag class="size-3.5" />
          Релизы
          <span
            v-if="releases.length"
            class="text-[10px] text-muted-foreground"
          >{{ releases.length }}</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="commits" class="mt-0 min-h-0 flex-1 overflow-y-auto">
        <div class="space-y-3 p-3">
          <section
            v-if="commitPlan"
            class="overflow-hidden rounded-lg border"
            :class="
              hasPendingRevisions
                ? 'border-amber-500/35 bg-amber-500/[0.045]'
                : 'border-emerald-500/25 bg-emerald-500/[0.035]'
            "
          >
            <div class="flex items-start gap-2.5 p-3">
              <div
                class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full"
                :class="
                  hasPendingRevisions
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                "
              >
                <History v-if="hasPendingRevisions" class="size-3.5" />
                <Check v-else class="size-3.5" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-semibold">
                  {{
                    hasPendingRevisions
                      ? "Есть незакоммиченные изменения"
                      : "Рабочая версия зафиксирована"
                  }}
                </p>
                <p class="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                  <template v-if="hasPendingRevisions">
                    {{ commitPlan.revisionCount }} ревизий в
                    {{ commitPlan.documentCount }} документах
                  </template>
                  <template v-else>
                    Новых ревизий после последнего коммита нет
                  </template>
                </p>
                <div
                  v-if="commitPlan.shared"
                  class="mt-2 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300"
                >
                  <Users class="size-3" />
                  В коммит войдут изменения нескольких участников
                </div>
              </div>
            </div>

            <form
              v-if="canWrite && hasPendingRevisions"
              class="border-t border-amber-500/20 p-2.5"
              @submit.prevent="createCommit"
            >
              <div class="flex gap-2">
                <Input
                  v-model="commitMessage"
                  class="h-8 text-xs"
                  :aria-invalid="Boolean(commitMessageError)"
                  maxlength="1000"
                  placeholder="Что изменилось?"
                />
                <Button
                  type="submit"
                  size="icon-sm"
                  :disabled="loading"
                  title="Создать коммит"
                >
                  <Loader2 v-if="loading" class="animate-spin" />
                  <Plus v-else />
                </Button>
              </div>
              <p
                v-if="commitMessageError"
                class="mt-1.5 text-[11px] text-destructive"
              >
                {{ commitMessageError }}
              </p>
              <p
                v-else-if="commitPlan.contributors.length"
                class="mt-1.5 truncate text-[10px] text-muted-foreground"
              >
                Авторы: {{ commitPlan.contributors.map(actorName).join(", ") }}
              </p>
            </form>
          </section>

          <div
            v-if="loading && commits.length === 0"
            class="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground"
          >
            <Loader2 class="size-4 animate-spin" />
            Загружаем историю…
          </div>
          <div
            v-else-if="commits.length === 0"
            class="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground"
          >
            Коммитов пока нет
          </div>
          <div v-else class="relative space-y-0.5 pl-4">
            <div class="absolute bottom-4 left-[7px] top-4 w-px bg-border" />
            <article
              v-for="commit in commits"
              :key="commit.id"
              class="group relative rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-muted/35"
            >
              <span
                class="absolute -left-[13px] top-4 size-2.5 rounded-full border-2 border-background ring-1 ring-border"
                :class="
                  isCurrentCommit(commit)
                    ? 'bg-emerald-500'
                    : isBaseCommit(commit)
                      ? 'bg-amber-500'
                      : 'bg-muted-foreground/45'
                "
              />
              <div class="flex min-w-0 items-start gap-2">
                <button type="button" class="min-w-0 flex-1 text-left" @click="openCommitDetails(commit)">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <p
                      class="truncate text-xs font-medium"
                      :title="commit.message"
                    >
                      {{ commit.message }}
                    </p>
                    <Badge
                      v-if="isCurrentCommit(commit)"
                      variant="outline"
                      class="h-4 border-emerald-500/35 px-1.5 text-[9px] text-emerald-700 dark:text-emerald-300"
                    >
                      Текущая
                    </Badge>
                    <Badge
                      v-else-if="isBaseCommit(commit)"
                      variant="outline"
                      class="h-4 border-amber-500/35 px-1.5 text-[9px] text-amber-700 dark:text-amber-300"
                    >
                      База
                    </Badge>
                  </div>
                  <p class="mt-1 truncate text-[10px] text-muted-foreground">
                    {{ actorName(commit.createdBy) }} ·
                    {{ formatDate(commit.createdAt) }} ·
                    {{ operationLabel(commit.operation) }}
                  </p>
                  <p
                    class="mt-0.5 font-mono text-[9px] text-muted-foreground/70"
                  >
                    {{ shortId(commit.id) }} · head {{ commit.headSequence }}
                  </p>
                </button>

                <div class="flex shrink-0 items-center gap-0.5">
                  <Tooltip v-if="releasesByCommit.get(commit.id)?.length">
                    <TooltipTrigger as-child>
                      <button
                        type="button"
                        class="flex h-7 items-center gap-1 rounded-md px-1.5 text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
                      >
                        <Tag class="size-3.5" />
                        <span class="text-[9px] font-semibold">{{
                          releasesByCommit.get(commit.id)?.length
                        }}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" class="max-w-56">
                      <p class="mb-1 text-[10px] font-semibold">
                        Релизы этого коммита
                      </p>
                      <p
                        v-for="release in releasesByCommit.get(commit.id)"
                        :key="release.id"
                        class="text-[10px]"
                      >
                        {{ release.displayName }}
                      </p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip v-if="canRestore && !isCurrentCommit(commit)">
                    <TooltipTrigger as-child>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        class="size-7 opacity-60 group-hover:opacity-100"
                        :disabled="loading"
                        @click="
                          requestRestore({
                            kind: 'commit',
                            id: commit.id,
                            title: commit.message,
                          })
                        "
                      >
                        <RotateCcw class="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      Восстановить эту версию
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </article>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="releases" class="mt-0 min-h-0 flex-1 overflow-y-auto">
        <div class="space-y-3 p-3">
          <section v-if="canWrite" class="rounded-lg border bg-muted/20 p-2.5">
            <form class="space-y-2" @submit.prevent="createRelease">
              <div class="flex gap-2">
                <Input
                  v-model="releaseName"
                  class="h-8 text-xs"
                  :aria-invalid="Boolean(releaseNameError)"
                  maxlength="160"
                  placeholder="Название релиза"
                />
                <Button
                  type="submit"
                  size="icon-sm"
                  :disabled="loading"
                  title="Создать релиз"
                >
                  <Loader2 v-if="loading" class="animate-spin" />
                  <Plus v-else />
                </Button>
              </div>
              <p v-if="releaseNameError" class="text-[11px] text-destructive">
                {{ releaseNameError }}
              </p>
              <button
                v-else-if="hasPendingRevisions"
                type="button"
                class="flex items-center gap-1.5 text-left text-[10px] text-amber-700 hover:underline dark:text-amber-300"
                @click="activeTab = 'commits'"
              >
                <AlertTriangle class="size-3" />
                Сначала создайте коммит текущих изменений
              </button>
              <p
                v-else-if="latestCommit"
                class="truncate text-[10px] text-muted-foreground"
              >
                Источник: {{ latestCommit.message }} ·
                {{ shortId(latestCommit.id) }}
              </p>
            </form>
          </section>

          <div
            v-if="loading && releases.length === 0"
            class="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground"
          >
            <Loader2 class="size-4 animate-spin" />
            Загружаем релизы…
          </div>
          <div
            v-else-if="releases.length === 0"
            class="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground"
          >
            Релизов пока нет
          </div>
          <template v-else>
            <article
              v-for="release in releases"
              :key="release.id"
              class="group rounded-lg border p-2.5 transition-colors hover:bg-muted/35"
            >
              <div class="flex items-start gap-2">
                <div
                  class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                >
                  <Tag class="size-3.5" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <p class="truncate text-xs font-medium">
                      {{ release.displayName }}
                    </p>
                    <Badge
                      v-if="isCurrentRelease(release)"
                      variant="outline"
                      class="h-4 border-emerald-500/35 px-1.5 text-[9px] text-emerald-700 dark:text-emerald-300"
                    >
                      Текущая
                    </Badge>
                  </div>
                  <p class="mt-1 truncate text-[10px] text-muted-foreground">
                    {{ actorName(release.createdBy) }} ·
                    {{ formatDate(release.createdAt) }}
                  </p>
                  <p
                    class="mt-0.5 font-mono text-[9px] text-muted-foreground/70"
                  >
                    commit {{ shortId(release.sourceCommitId) }} · head
                    {{ release.headSequence }}
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-0.5">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        class="size-7"
                        @click="downloadRelease(release.identity)"
                      >
                        <Download class="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      Скачать JSON
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip v-if="canRestore && !isCurrentRelease(release)">
                    <TooltipTrigger as-child>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        class="size-7"
                        :disabled="loading"
                        @click="
                          requestRestore({
                            kind: 'release',
                            id: release.identity,
                            title: release.displayName,
                          })
                        "
                      >
                        <RotateCcw class="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      Восстановить релиз
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </article>
          </template>
        </div>
      </TabsContent>
    </Tabs>

    <Dialog v-model:open="commitDetailsOpen">
      <DialogContent class="max-h-[80vh] overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader class="border-b bg-muted/25 px-5 py-4 pr-12 text-left">
          <DialogTitle class="text-base">
            {{ commitDetails?.message }}
          </DialogTitle>
          <DialogDescription v-if="commitDetails">
            {{ actorName(commitDetails.createdBy) }} · {{ formatDate(commitDetails.createdAt) }} ·
            {{ operationLabel(commitDetails.operation) }}
          </DialogDescription>
        </DialogHeader>

        <div v-if="commitDetails" class="min-h-0 overflow-y-auto px-5 py-4">
          <div class="mb-3 flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-[11px]">
            <span class="text-muted-foreground">Commit</span>
            <span class="font-mono">{{ commitDetails.id }}</span>
          </div>
          <p class="mb-2 text-xs font-semibold">
            Изменения · {{ commitDetails.changes.length }}
          </p>
          <div v-if="commitDetails.changes.length" class="space-y-1.5">
            <div
              v-for="change in commitDetails.changes"
              :key="`${change.documentType}:${change.documentId}`"
              class="flex items-center gap-2 rounded-md border px-3 py-2"
            >
              <GitCommitHorizontal class="size-3.5 shrink-0 text-muted-foreground" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium">
                  {{ change.documentType }}
                </p>
                <p class="truncate font-mono text-[9px] text-muted-foreground">
                  {{ change.documentId }}
                </p>
              </div>
              <Badge variant="outline" class="h-5 px-1.5 text-[9px]">
                {{ change.operation }}
              </Badge>
            </div>
          </div>
          <div v-else class="rounded-md border border-dashed p-5 text-center text-xs text-muted-foreground">
            Детализированных изменений нет
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="restoreDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Восстановить «{{ restoreTarget?.title }}»?</DialogTitle>
          <DialogDescription>
            Workspace перейдёт к выбранному состоянию для всех пользователей.
            История сохранится: backend создаст новый коммит восстановления.
          </DialogDescription>
        </DialogHeader>

        <div v-if="restorePlan" class="space-y-3">
          <div
            class="grid grid-cols-2 gap-2 rounded-lg border bg-muted/25 p-3 text-xs"
          >
            <div>
              <p class="text-muted-foreground">
                Объектов в плане
              </p>
              <p class="mt-0.5 text-base font-semibold">
                {{ restoreChanges }}
              </p>
            </div>
            <div>
              <p class="text-muted-foreground">
                Текущий head
              </p>
              <p class="mt-0.5 font-mono text-base font-semibold">
                {{ restorePlan.expectedHeadSequence }}
              </p>
            </div>
          </div>
          <div
            class="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/[0.06] p-2.5 text-[11px] leading-4 text-amber-800 dark:text-amber-200"
          >
            <AlertTriangle class="mt-0.5 size-3.5 shrink-0" />
            Убедитесь, что изменения в открытых редакторах сохранены. После
            восстановления домен будет полностью перезагружен.
          </div>
        </div>

        <DialogFooter class="gap-2">
          <Button
            type="button"
            variant="outline"
            :disabled="loading"
            @click="restoreDialogOpen = false"
          >
            Отмена
          </Button>
          <Button
            type="button"
            variant="destructive"
            :disabled="loading"
            @click="confirmRestore"
          >
            <Loader2 v-if="loading" class="animate-spin" />
            <RotateCcw v-else />
            Восстановить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </TooltipProvider>
</template>
