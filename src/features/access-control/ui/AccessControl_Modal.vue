<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { AccessControlUser, AccessGrant, WorkspaceAccessRole } from '@/features/access-control'

import { Endge } from '@endge/core'
import { KeyRound, Loader2, Search, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { Configurator } from '@/app'
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
import { AccessControl_Module, AccessControl_Service } from '@/features/access-control'

const openState = ref(false)
const activeTab = ref('workspace')
const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const workspaceGrants = ref<AccessGrant[]>([])
const workspaceCursor = ref('')
const platformGrants = ref<AccessGrant[]>([])
const platformCursor = ref('')
const searchQuery = ref('')
const searchResults = ref<AccessControlUser[]>([])
const searchCursor = ref('')
const searching = ref(false)
const selectedUser = ref<AccessControlUser | null>(null)
const selectedRole = ref<WorkspaceAccessRole>('viewer')
const selectedWorkspaces = ref<string[]>([])
const bulkRole = ref<WorkspaceAccessRole>('viewer')
const selectedUserGrants = ref<AccessGrant[]>([])
const selectedUserPlatformGrant = ref<AccessGrant | null>(null)
const selectedUserCursor = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null
let searchController: AbortController | null = null

const access = new AccessControl_Module(new AccessControl_Service(Configurator.connections.activeBackendURL))
const session = computed(() => Configurator.session.state.status === 'authenticated' ? Configurator.session.state.session : null)
const platformAdmin = computed(() => session.value?.platformAdmin === true)
const currentUserID = computed(() => session.value?.developer.id ?? '')
const workspaceIdentity = computed(() => Endge.workspace.current.identity)
const availableWorkspaces = computed(() => session.value?.workspaces.filter(item => item.active) ?? [])

watch(searchQuery, () => {
  selectedUser.value = null
  searchResults.value = []
  searchCursor.value = ''
  scheduleSearch()
})

watch(activeTab, () => {
  searchQuery.value = ''
  selectedUser.value = null
  errorMessage.value = ''
  if (activeTab.value === 'platform' && platformAdmin.value && platformGrants.value.length === 0) {
    void loadPlatformGrants()
  }
})

onBeforeUnmount(() => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchController?.abort()
})

function open(): void {
  errorMessage.value = ''
  activeTab.value = 'workspace'
  openState.value = true
  void loadWorkspaceGrants()
}

function scheduleSearch(): void {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchController?.abort()
  if ([...searchQuery.value.trim()].length < 2) {
    searching.value = false
    return
  }
  searchTimer = setTimeout(() => void searchUsers(false), 300)
}

async function searchUsers(append: boolean): Promise<void> {
  searchController?.abort()
  searchController = new AbortController()
  searching.value = true
  errorMessage.value = ''
  try {
    const page = await access.searchUsers(
      searchQuery.value.trim(),
      platformAdmin.value ? undefined : workspaceIdentity.value,
      append ? searchCursor.value : '',
      searchController.signal,
    )
    searchResults.value = append ? [...searchResults.value, ...page.items] : page.items
    searchCursor.value = page.nextCursor ?? ''
  }
  catch (error) {
    if ((error as Error).name !== 'AbortError') {
      setError(error)
    }
  }
  finally {
    searching.value = false
  }
}

async function loadWorkspaceGrants(append = false): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await access.listGrants('workspace', workspaceIdentity.value, '', append ? workspaceCursor.value : '')
    workspaceGrants.value = append ? [...workspaceGrants.value, ...page.items] : page.items
    workspaceCursor.value = page.nextCursor ?? ''
  }
  catch (error) {
    setError(error)
  }
  finally {
    loading.value = false
  }
}

async function loadPlatformGrants(append = false): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await access.listGrants('platform', undefined, '', append ? platformCursor.value : '')
    platformGrants.value = append ? [...platformGrants.value, ...page.items] : page.items
    platformCursor.value = page.nextCursor ?? ''
  }
  catch (error) {
    setError(error)
  }
  finally {
    loading.value = false
  }
}

function selectUser(user: AccessControlUser): void {
  selectedUser.value = user
  selectedWorkspaces.value = []
  selectedUserGrants.value = []
  selectedUserPlatformGrant.value = null
  if (platformAdmin.value && activeTab.value === 'user') {
    void loadSelectedUserAccess()
  }
}

async function loadSelectedUserAccess(append = false): Promise<void> {
  if (!selectedUser.value) {
    return
  }
  const userID = selectedUser.value.id
  loading.value = true
  errorMessage.value = ''
  try {
    const [workspacePage, platformPage] = await Promise.all([
      access.listGrants('workspace', undefined, '', append ? selectedUserCursor.value : '', userID),
      access.listGrants('platform', undefined, '', '', userID),
    ])
    if (selectedUser.value?.id !== userID) {
      return
    }
    selectedUserGrants.value = append ? [...selectedUserGrants.value, ...workspacePage.items] : workspacePage.items
    selectedUserCursor.value = workspacePage.nextCursor ?? ''
    selectedUserPlatformGrant.value = platformPage.items[0] ?? null
  }
  catch (error) {
    setError(error)
  }
  finally {
    loading.value = false
  }
}

async function addWorkspaceGrant(): Promise<void> {
  if (!selectedUser.value) {
    return
  }
  submitting.value = true
  try {
    await access.putGrant({
      userId: selectedUser.value.id,
      scopeType: 'workspace',
      workspaceIdentity: workspaceIdentity.value,
      role: selectedRole.value,
    })
    await afterMutation(selectedUser.value.id, () => loadWorkspaceGrants())
  }
  catch (error) {
    setError(error)
  }
  finally {
    submitting.value = false
  }
}

async function addPlatformAdmin(): Promise<void> {
  if (!selectedUser.value) {
    return
  }
  const confirmed = await Configurator.questions.ask({
    title: 'Назначить Platform Admin?',
    text: selectedUser.value.displayName || selectedUser.value.username || selectedUser.value.id,
    description: 'Пользователь получит полный доступ к backend, всем Workspace и управлению правами.',
    answers: [
      { value: false, text: 'Отмена', variant: 'outline' },
      { value: true, text: 'Назначить', variant: 'default' },
    ],
  })
  if (!confirmed) {
    return
  }
  submitting.value = true
  try {
    await access.putGrant({ userId: selectedUser.value.id, scopeType: 'platform', role: 'admin' })
    await afterMutation(
      selectedUser.value.id,
      activeTab.value === 'user' ? () => loadSelectedUserAccess() : () => loadPlatformGrants(),
    )
  }
  catch (error) {
    setError(error)
  }
  finally {
    submitting.value = false
  }
}

async function updateWorkspaceGrant(grant: AccessGrant, role: WorkspaceAccessRole): Promise<void> {
  submitting.value = true
  try {
    await access.putGrant({ userId: grant.user.id, scopeType: 'workspace', workspaceIdentity: workspaceIdentity.value, role })
    await afterMutation(grant.user.id, () => loadWorkspaceGrants())
  }
  catch (error) {
    setError(error)
  }
  finally {
    submitting.value = false
  }
}

async function updateSelectedWorkspaceGrant(grant: AccessGrant, role: WorkspaceAccessRole): Promise<void> {
  if (!grant.workspaceIdentity) {
    return
  }
  submitting.value = true
  try {
    await access.putGrant({ userId: grant.user.id, scopeType: 'workspace', workspaceIdentity: grant.workspaceIdentity, role })
    await afterMutation(grant.user.id, () => loadSelectedUserAccess())
  }
  catch (error) {
    setError(error)
  }
  finally {
    submitting.value = false
  }
}

async function removeGrant(grant: AccessGrant): Promise<void> {
  const confirmed = await Configurator.questions.ask({
    title: grant.scopeType === 'platform' ? 'Отозвать Platform Admin?' : 'Отозвать доступ?',
    text: grant.user.displayName || grant.user.username || grant.user.id,
    description: grant.scopeType === 'platform'
      ? 'Полный доступ к платформе будет отозван.'
      : `Доступ к Workspace ${grant.workspaceIdentity || workspaceIdentity.value} будет отозван.`,
    answers: [
      { value: false, text: 'Отмена', variant: 'outline' },
      { value: true, text: 'Отозвать', variant: 'destructive' },
    ],
  })
  if (!confirmed) {
    return
  }
  submitting.value = true
  try {
    await access.deleteGrant(grant.id)
    const refresh = activeTab.value === 'user'
      ? () => loadSelectedUserAccess()
      : grant.scopeType === 'platform'
        ? () => loadPlatformGrants()
        : () => loadWorkspaceGrants()
    await afterMutation(grant.user.id, refresh)
  }
  catch (error) {
    setError(error)
  }
  finally {
    submitting.value = false
  }
}

function toggleWorkspace(identity: string): void {
  selectedWorkspaces.value = selectedWorkspaces.value.includes(identity)
    ? selectedWorkspaces.value.filter(item => item !== identity)
    : [...selectedWorkspaces.value, identity]
}

async function applyBulk(allActive: boolean): Promise<void> {
  if (!selectedUser.value) {
    return
  }
  const count = allActive ? availableWorkspaces.value.length : selectedWorkspaces.value.length
  if (count === 0) {
    return
  }
  const confirmed = await Configurator.questions.ask({
    title: `Назначить ${bulkRole.value} в ${count} Workspace?`,
    text: selectedUser.value.displayName || selectedUser.value.username || selectedUser.value.id,
    description: allActive ? 'Роль применяется ко всем текущим активным Workspace. Новые Workspace в назначение не войдут.' : 'Существующие роли в выбранных Workspace будут заменены.',
    answers: [
      { value: false, text: 'Отмена', variant: 'outline' },
      { value: true, text: 'Применить', variant: 'default' },
    ],
  })
  if (!confirmed) {
    return
  }
  submitting.value = true
  try {
    await access.bulkWorkspaceGrants({
      userId: selectedUser.value.id,
      role: bulkRole.value,
      selection: allActive ? { type: 'all-active' } : { type: 'selected', workspaceIdentities: selectedWorkspaces.value },
    })
    await afterMutation(selectedUser.value.id, () => loadSelectedUserAccess())
  }
  catch (error) {
    setError(error)
  }
  finally {
    submitting.value = false
  }
}

async function afterMutation(userID: string, refresh: () => Promise<void>): Promise<void> {
  if (userID === currentUserID.value) {
    window.location.reload()
    return
  }
  await refresh()
}

function setError(error: unknown): void {
  errorMessage.value = error instanceof Error ? error.message : 'Не удалось изменить права'
}

defineExpose({ open })
</script>

<template>
  <Dialog v-model:open="openState">
    <DialogContent class="max-h-[90vh] overflow-hidden p-0 sm:max-w-4xl">
      <DialogHeader class="border-b bg-muted/35 px-6 py-5 text-left">
        <DialogTitle class="flex items-center gap-2">
          <ShieldCheck class="size-4 text-primary" />
          Управление доступом
        </DialogTitle>
        <DialogDescription>
          {{ platformAdmin ? 'Права платформы и рабочих пространств' : `Workspace: ${workspaceIdentity}` }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="errorMessage" class="mx-6 mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        {{ errorMessage }}
      </div>

      <Tabs v-model="activeTab" class="min-h-0 overflow-y-auto px-6 py-5">
        <TabsList v-if="platformAdmin" class="grid w-full grid-cols-3">
          <TabsTrigger value="workspace">
            Текущий Workspace
          </TabsTrigger>
          <TabsTrigger value="platform">
            Администраторы платформы
          </TabsTrigger>
          <TabsTrigger value="user">
            Доступ пользователя
          </TabsTrigger>
        </TabsList>

        <div class="mt-4 rounded-lg border bg-muted/20 p-3">
          <div class="relative">
            <Search class="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input v-model="searchQuery" class="pl-9" placeholder="Начните вводить username…" autocomplete="off" />
          </div>
          <div v-if="searching" class="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
            <Loader2 class="size-3.5 animate-spin" /> Поиск пользователей…
          </div>
          <div v-else-if="searchResults.length" class="mt-2 max-h-36 space-y-1 overflow-y-auto">
            <button
              v-for="user in searchResults"
              :key="user.id"
              type="button"
              class="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-accent"
              :class="selectedUser?.id === user.id ? 'bg-accent' : ''"
              @click="selectUser(user)"
            >
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium">{{ user.displayName || user.username || user.id }}</span>
                <span class="block truncate text-xs text-muted-foreground">{{ user.username }} · {{ user.providerId }}</span>
              </span>
              <UserPlus class="size-4 shrink-0 text-muted-foreground" />
            </button>
            <Button v-if="searchCursor" variant="ghost" size="sm" class="w-full" @click="searchUsers(true)">
              Показать ещё
            </Button>
          </div>
          <p v-else-if="searchQuery.trim().length >= 2 && !searching" class="px-2 py-3 text-xs text-muted-foreground">
            Пользователи не найдены
          </p>
        </div>

        <TabsContent value="workspace" class="mt-4 space-y-4">
          <div v-if="selectedUser" class="flex items-center gap-2 rounded-lg border p-3">
            <div class="min-w-0 flex-1 text-sm">
              <span class="font-medium">{{ selectedUser.displayName || selectedUser.username }}</span>
              <span class="ml-2 text-xs text-muted-foreground">{{ selectedUser.username }}</span>
            </div>
            <select v-model="selectedRole" class="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="viewer">
                Viewer
              </option><option value="editor">
                Editor
              </option><option value="admin">
                Admin
              </option>
            </select>
            <Button :disabled="submitting" class="gap-2" @click="addWorkspaceGrant">
              <UserPlus class="size-4" /> Назначить
            </Button>
          </div>

          <div class="max-h-[34vh] space-y-2 overflow-y-auto pr-1">
            <div v-for="grant in workspaceGrants" :key="grant.id" class="flex items-center gap-3 rounded-lg border px-3 py-2.5">
              <Users class="size-4 shrink-0 text-muted-foreground" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">
                  {{ grant.user.displayName || grant.user.username || grant.user.id }}
                </p>
                <p class="truncate text-xs text-muted-foreground">
                  {{ grant.user.username }} · {{ grant.user.providerId }}
                </p>
              </div>
              <select :value="grant.role" class="h-8 rounded-md border bg-background px-2 text-xs" :disabled="submitting" @change="updateWorkspaceGrant(grant, ($event.target as HTMLSelectElement).value as WorkspaceAccessRole)">
                <option value="viewer">
                  Viewer
                </option><option value="editor">
                  Editor
                </option><option value="admin">
                  Admin
                </option>
              </select>
              <Button variant="ghost" size="icon" class="size-8 hover:text-destructive" :disabled="submitting" @click="removeGrant(grant)">
                <Trash2 class="size-4" />
              </Button>
            </div>
            <div v-if="loading" class="flex justify-center py-8">
              <Loader2 class="size-5 animate-spin text-muted-foreground" />
            </div>
            <Button v-if="workspaceCursor && !loading" variant="outline" size="sm" class="w-full" @click="loadWorkspaceGrants(true)">
              Показать ещё
            </Button>
          </div>
        </TabsContent>

        <TabsContent v-if="platformAdmin" value="platform" class="mt-4 space-y-4">
          <div v-if="selectedUser" class="flex items-center gap-3 rounded-lg border p-3">
            <KeyRound class="size-4 text-primary" />
            <div class="min-w-0 flex-1 text-sm">
              <span class="font-medium">{{ selectedUser.displayName || selectedUser.username }}</span><span class="ml-2 text-xs text-muted-foreground">{{ selectedUser.username }}</span>
            </div>
            <Button :disabled="submitting" @click="addPlatformAdmin">
              Сделать Platform Admin
            </Button>
          </div>
          <div class="max-h-[34vh] space-y-2 overflow-y-auto pr-1">
            <div v-for="grant in platformGrants" :key="grant.id" class="flex items-center gap-3 rounded-lg border px-3 py-2.5">
              <ShieldCheck class="size-4 text-primary" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">
                  {{ grant.user.displayName || grant.user.username }}
                </p><p class="truncate text-xs text-muted-foreground">
                  {{ grant.user.username }} · {{ grant.user.providerId }}
                </p>
              </div>
              <span class="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">Platform Admin</span>
              <Button variant="ghost" size="icon" class="size-8 hover:text-destructive" :disabled="submitting" @click="removeGrant(grant)">
                <Trash2 class="size-4" />
              </Button>
            </div>
            <Button v-if="platformCursor && !loading" variant="outline" size="sm" class="w-full" @click="loadPlatformGrants(true)">
              Показать ещё
            </Button>
          </div>
        </TabsContent>

        <TabsContent v-if="platformAdmin" value="user" class="mt-4 space-y-4">
          <div v-if="selectedUser" class="space-y-4 rounded-lg border p-4">
            <div class="flex items-center gap-3">
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">
                  {{ selectedUser.displayName || selectedUser.username }}
                </p>
                <p class="truncate text-xs text-muted-foreground">
                  {{ selectedUser.username }} · {{ selectedUser.providerId }}
                </p>
              </div>
              <Button
                v-if="selectedUserPlatformGrant"
                variant="outline"
                :disabled="submitting"
                @click="removeGrant(selectedUserPlatformGrant)"
              >
                Отозвать Platform Admin
              </Button>
              <Button v-else :disabled="submitting" @click="addPlatformAdmin">
                Сделать Platform Admin
              </Button>
            </div>
            <div class="flex items-center gap-2 border-t pt-4">
              <select v-model="bulkRole" class="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="viewer">
                  Viewer
                </option><option value="editor">
                  Editor
                </option><option value="admin">
                  Admin
                </option>
              </select>
              <Button variant="outline" :disabled="submitting" @click="applyBulk(true)">
                Все текущие Workspace
              </Button>
              <Button :disabled="submitting || selectedWorkspaces.length === 0" @click="applyBulk(false)">
                Применить к выбранным ({{ selectedWorkspaces.length }})
              </Button>
            </div>
            <div class="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto border-t pt-4">
              <label v-for="workspace in availableWorkspaces" :key="workspace.id" class="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
                <input type="checkbox" :checked="selectedWorkspaces.includes(workspace.identity)" @change="toggleWorkspace(workspace.identity)">
                <span class="truncate">{{ workspace.displayName }}</span>
                <span class="ml-auto truncate font-mono text-[10px] text-muted-foreground">{{ workspace.identity }}</span>
              </label>
            </div>
            <div class="max-h-52 space-y-2 overflow-y-auto border-t pt-4">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Прямые права в Workspace
              </p>
              <div
                v-for="grant in selectedUserGrants"
                :key="grant.id"
                class="flex items-center gap-3 rounded-md border px-3 py-2"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">
                    {{ grant.workspaceDisplayName || grant.workspaceIdentity }}
                  </p>
                  <p class="truncate font-mono text-[10px] text-muted-foreground">
                    {{ grant.workspaceIdentity }}
                  </p>
                </div>
                <select
                  :value="grant.role"
                  class="h-8 rounded-md border bg-background px-2 text-xs"
                  :disabled="submitting"
                  @change="updateSelectedWorkspaceGrant(grant, ($event.target as HTMLSelectElement).value as WorkspaceAccessRole)"
                >
                  <option value="viewer">
                    Viewer
                  </option>
                  <option value="editor">
                    Editor
                  </option>
                  <option value="admin">
                    Admin
                  </option>
                </select>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8 hover:text-destructive"
                  :disabled="submitting"
                  @click="removeGrant(grant)"
                >
                  <Trash2 class="size-4" />
                </Button>
              </div>
              <p v-if="!loading && selectedUserGrants.length === 0" class="py-3 text-center text-xs text-muted-foreground">
                Прямых назначений нет
              </p>
              <Button
                v-if="selectedUserCursor && !loading"
                variant="outline"
                size="sm"
                class="w-full"
                @click="loadSelectedUserAccess(true)"
              >
                Показать ещё
              </Button>
            </div>
          </div>
          <div v-else class="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            Найдите и выберите пользователя выше
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter class="border-t bg-muted/25 px-6 py-3">
        <Button variant="outline" @click="openState = false">
          Закрыть
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
