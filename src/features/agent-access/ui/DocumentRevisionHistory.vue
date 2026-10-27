<script setup lang="ts">
import type { AgentAttributedRevision } from '@/features/agent-access/domain/types/agent-access.type'

import { Bot, RefreshCw, TriangleAlert } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { Configurator } from '@/app/Configurator'
import { Button } from '@/components/ui/button'
import { AgentAccessError } from '@/features/agent-access/adapters/AgentAccessHttp_Adapter'
import { DOCUMENT_REVISIONS_PAGE_SIZE } from '@/features/agent-access/AgentAccess_Module'

const props = defineProps<{
  workspaceIdentity: string
  collection: string
  identity: string
}>()

const { t, locale } = useI18n()
const status = ref<'loading' | 'ready' | 'error' | 'missing'>('loading')
const revisions = ref<AgentAttributedRevision[]>([])
const total = ref(0)
const loadingMore = ref(false)
const moreError = ref(false)
const hasMore = computed(() => status.value === 'ready' && revisions.value.length < total.value)

function ownerFilter(): 'all' | 'me' {
  const state = Configurator.session.state
  return state.status === 'authenticated' && state.session.platformAdmin ? 'all' : 'me'
}

function fetchPage(offset: number) {
  return Configurator.agentAccess.loadDocumentRevisions(
    props.workspaceIdentity,
    props.collection,
    props.identity,
    ownerFilter(),
    { limit: DOCUMENT_REVISIONS_PAGE_SIZE, offset },
  )
}

async function load(): Promise<void> {
  status.value = 'loading'
  moreError.value = false
  try {
    const page = await fetchPage(0)
    revisions.value = page.items
    total.value = page.total
    status.value = 'ready'
  }
  catch (error) {
    revisions.value = []
    total.value = 0
    status.value = error instanceof AgentAccessError && error.status === 404 ? 'missing' : 'error'
  }
}

// Следующая страница дописывается в конец; ревизии, сдвинутые новыми правками, не дублируются.
async function loadMore(): Promise<void> {
  if (loadingMore.value || !hasMore.value) {
    return
  }
  loadingMore.value = true
  moreError.value = false
  try {
    const page = await fetchPage(revisions.value.length)
    const known = new Set(revisions.value.map(revision => revision.id))
    revisions.value = [...revisions.value, ...page.items.filter(revision => !known.has(revision.id))]
    total.value = page.items.length ? page.total : revisions.value.length
  }
  catch {
    moreError.value = true
  }
  finally {
    loadingMore.value = false
  }
}

function authorLabel(revision: AgentAttributedRevision): string {
  return revision.createdBy.displayName || revision.createdBy.username || revision.createdBy.id
}

function agentLabel(revision: AgentAttributedRevision): string {
  if (!revision.agent) {
    return ''
  }
  return revision.agent.name
    ? t('agentAccess.history.agent', { name: revision.agent.name })
    : t('agentAccess.history.agentUnknown', { id: revision.agent.tokenId.slice(0, 8) })
}

function operationLabel(operation: string): string {
  switch (operation) {
    case 'create': return t('agentAccess.history.operationCreate')
    case 'update': return t('agentAccess.history.operationUpdate')
    case 'delete': return t('agentAccess.history.operationDelete')
    case 'restore': return t('agentAccess.history.operationRestore')
    case 'import': return t('agentAccess.history.operationImport')
    default: return operation
  }
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

onMounted(load)
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <header class="flex shrink-0 items-center gap-2 border-b px-4 py-2">
      <h3 class="text-sm font-medium">
        {{ t('agentAccess.history.title') }}
      </h3>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        class="ml-auto"
        :disabled="status === 'loading'"
        @click="load"
      >
        <RefreshCw class="size-3.5" :class="status === 'loading' ? 'animate-spin' : ''" />
        {{ t('agentAccess.history.refresh') }}
      </Button>
    </header>
    <div class="min-h-0 flex-1 overflow-auto px-4 py-3">
      <p v-if="status === 'loading' && !revisions.length" class="text-sm text-muted-foreground">
        {{ t('agentAccess.history.loading') }}
      </p>
      <p v-else-if="status === 'missing'" class="text-sm text-muted-foreground">
        {{ t('agentAccess.history.unsaved') }}
      </p>
      <div v-else-if="status === 'error'" class="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
        <TriangleAlert class="mt-0.5 size-4 shrink-0" />
        <span>{{ t('agentAccess.history.error') }}</span>
      </div>
      <p v-else-if="!revisions.length" class="text-sm text-muted-foreground">
        {{ t('agentAccess.history.empty') }}
      </p>
      <ol v-else class="divide-y rounded-lg border">
        <li
          v-for="revision in revisions"
          :key="revision.id"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
        >
          <span class="font-medium tabular-nums">{{ t('agentAccess.history.revision', { number: revision.revisionNumber }) }}</span>
          <span class="text-muted-foreground">{{ operationLabel(revision.operation) }}</span>
          <span>{{ authorLabel(revision) }}</span>
          <span
            v-if="revision.agent"
            class="inline-flex items-center gap-1 rounded bg-fuchsia-500/10 px-1.5 py-0.5 text-xs font-medium text-fuchsia-700 dark:text-fuchsia-300"
            data-testid="revision-agent-marker"
          >
            <Bot class="size-3" />
            {{ agentLabel(revision) }}
          </span>
          <time class="ml-auto text-xs text-muted-foreground" :datetime="revision.createdAt">{{ formatDate(revision.createdAt) }}</time>
        </li>
      </ol>
      <div v-if="status === 'ready' && revisions.length" class="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
        <span>{{ t('agentAccess.history.shown', { shown: revisions.length, total }) }}</span>
        <span v-if="moreError" class="text-destructive">{{ t('agentAccess.history.error') }}</span>
        <Button
          v-if="hasMore"
          type="button"
          size="sm"
          variant="outline"
          class="ml-auto"
          :disabled="loadingMore"
          data-testid="revision-history-more"
          @click="loadMore"
        >
          {{ t('agentAccess.history.more') }}
        </Button>
      </div>
    </div>
  </section>
</template>
