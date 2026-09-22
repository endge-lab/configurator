<script setup lang="ts">
import { Endge } from '@endge/core'

import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Configurator } from '@/app/Configurator'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import SourceJsonTree from '@/features/endge-ide/ui/components/SourceJsonTree.vue'

const session = Configurator.remoteDebugger
const layoutKey = 'configurator.inspection.list-width'
const userIdentity = Configurator.context.userIdentity
const savedSize = userIdentity ? Endge.context.getUserState<number>(userIdentity, layoutKey) : undefined
const listSize = typeof savedSize === 'number' && Number.isFinite(savedSize) ? Math.max(20, Math.min(80, savedSize)) : 50
let pendingSize = listSize
let layoutTimer: ReturnType<typeof setTimeout> | undefined
function persistLayout(): void {
  clearTimeout(layoutTimer)
  layoutTimer = undefined
  if (userIdentity) {
    Endge.context.setUserState(userIdentity, layoutKey, pendingSize)
  }
}
function saveLayout(sizes: number[]): void {
  if (sizes[0] === undefined || !Number.isFinite(sizes[0]) || sizes[0] === pendingSize) {
    return
  }
  pendingSize = Math.max(20, Math.min(80, sizes[0]))
  clearTimeout(layoutTimer)
  layoutTimer = setTimeout(persistLayout, 200)
}
onBeforeUnmount(() => {
  if (layoutTimer) {
    persistLayout()
  }
})
const revision = ref(0)
const off = Endge.inspection.subscribe(() => revision.value++)
onBeforeUnmount(off)
const history = computed(() => {
  void revision.value
  const module = Endge.inspection
  return {
    records: module.records,
    appliedSequence: module.appliedSequence,
    receivedSequence: module.receivedSequence,
    followLive: module.followLive,
    bytes: module.bytes,
    error: module.error,
    gaps: module.gaps,
    archives: module.archives,
    stepBackward: () => module.stepBackward(),
    stepForward: () => module.stepForward(),
    setFollowLive: (value: boolean) => module.setFollowLive(value),
  }
})
const search = ref('')
const kind = ref('all')
const selected = ref<number | null>(null)
const visible = ref(200)
const filtered = computed(() =>
  history.value.records.filter(
    record =>
      (kind.value === 'all' || record.kind === kind.value)
      && `${record.sequence} ${record.kind} ${'name' in record ? record.name : ''} ${'reason' in record ? record.reason : ''}`
        .toLowerCase()
        .includes(search.value.toLowerCase()),
  ),
)
const details = computed(() =>
  history.value.records.find(
    record =>
      record.sequence === (selected.value ?? history.value.appliedSequence),
  ),
)
function attempt(action: () => void | Promise<void>): void {
  Promise.resolve()
    .then(action)
    .catch(error =>
      toast.error(error instanceof Error ? error.message : String(error)),
    )
}
const { t } = useI18n()
</script>

<template>
  <div
    class="flex h-full min-h-0 flex-col overflow-auto text-xs"
    data-testid="inspection-history"
  >
    <div class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1">
      <label class="flex shrink-0 items-center gap-2"><Checkbox
        :model-value="history.followLive"
        @update:model-value="
          (value) =>
            attempt(() => {
              session.pause();
              history.setFollowLive(value === true);
            })
        "
      /> {{ t('bundleInspection.follow') }} </label>

      <template v-if="session.source.value === 'remote'">
        <label class="flex items-center gap-2"><Checkbox
          :model-value="session.skipData.value"
          :disabled="!session.connected.value || session.inspectionBusy.value"
          @update:model-value="
            (value) => attempt(() => session.setSkipData(value === true))
          "
        /> {{ t('bundleInspection.skipData') }} </label>
        <Button
          size="sm"
          variant="ghost"
          :disabled="!session.connected.value || session.inspectionBusy.value"
          @click="attempt(() => session.refreshInspection())"
        >
          {{ t('bundleInspection.requestSnapshot') }}
        </Button>
      </template>
      <span class="ml-auto tabular-nums text-muted-foreground"> {{ t('bundleInspection.viewing') }} {{ history.appliedSequence ?? "—" }} {{ t('bundleInspection.received') }} {{ history.receivedSequence ?? "—" }} {{ t('bundleInspection.separator') }} {{ history.records.length }} {{ t('bundleInspection.recordsSeparator') }} {{ (history.bytes / 1024).toFixed(1) }} {{ t('bundleInspection.sizeUnit') }} </span>
    </div>
    <div
      v-if="history.archives.length"
      class="flex shrink-0 flex-wrap gap-3 border-b px-3 py-1"
    >
      <span> {{ t('bundleInspection.previousSessions') }} </span>
      <span
        v-for="archive in history.archives"
        :key="archive.recordingId"
        class="flex items-center gap-2"
      >
        <button
          class="underline"
          @click="attempt(() => session.downloadArchived(archive.recordingId))"
        >
          {{ archive.runId.slice(0, 8) }} {{ t('bundleInspection.separator') }} {{ archive.records }} {{ t('bundleInspection.archiveDownload') }} </button>
        <button
          :aria-label="`Удалить архив ${archive.recordingId}`"
          @click="Endge.inspection.removeArchived(archive.recordingId)"
        > {{ t('bundleInspection.removeArchive') }} </button>
      </span>
    </div>
    <p
      v-for="gap in history.gaps"
      :key="gap.resumedAt"
      class="shrink-0 px-3 text-amber-600"
    >
      {{ t('bundleInspection.gap') }} {{ gap.from }} {{ t('bundleInspection.dash') }} {{ gap.to }} {{ t('bundleInspection.resumed') }} {{ gap.resumedAt }} {{ t('bundleInspection.period') }}
    </p>
    <p v-if="history.error" role="alert" class="px-3 text-destructive">
      {{ history.error }}
    </p>
    <SplitterGroup direction="horizontal" class="min-h-40 flex-1" @layout="saveLayout">
      <SplitterPanel :default-size="listSize" :min-size="20" class="flex min-h-0 min-w-0 flex-col">
        <div class="flex shrink-0 gap-2 p-2">
          <Input
            v-model="search"
            placeholder="Поиск по событиям…"
            class="h-7 text-xs"
          /><select
            v-model="kind"
            aria-label="Тип записи"
            class="rounded border bg-background px-2"
          >
            <option value="all">
              {{ t('bundleInspection.allRecords') }}
            </option>
            <option value="snapshot">
              {{ t('bundleInspection.snapshots') }}
            </option>
            <option value="delta">
              {{ t('bundleInspection.changes') }}
            </option>
            <option value="event">
              {{ t('bundleInspection.events') }}
            </option>
            <option value="marker">
              {{ t('bundleInspection.markers') }}
            </option>
          </select>
        </div>
        <div
          class="min-h-0 flex-1 overflow-auto px-1"
          role="list"
          aria-label="Записи инспекции"
        >
          <button
            v-for="record in filtered.slice(0, visible)"
            :key="record.sequence"
            type="button"
            class="flex w-full gap-3 rounded px-2 py-1.5 text-left hover:bg-accent"
            :class="{
              'bg-accent': record.sequence === history.appliedSequence,
            }"
            @click="selected = record.sequence"
            @dblclick="attempt(() => session.seek(record.sequence))"
          >
            <span class="w-12 shrink-0 tabular-nums">{{ record.sequence }}</span><span class="w-20 shrink-0">{{ record.kind }}</span><span class="truncate text-muted-foreground">{{
              "reason" in record
                ? record.reason
                : "name" in record
                  ? record.name
                  : `${record.baseRevision} → ${record.revision}`
            }}</span>
          </button>
          <Button
            v-if="filtered.length > visible"
            variant="ghost"
            size="sm"
            @click="visible += 200"
          >
            {{ t('bundleInspection.more') }} {{ Math.min(200, filtered.length - visible) }} {{ t('bundleInspection.records') }}
          </Button>
          <p v-if="!history.records.length" class="p-3 text-muted-foreground">
            {{ t('bundleInspection.noRuntime') }}
          </p>
        </div>
      </SplitterPanel>
      <SplitterResizeHandle :aria-label="t('bundleInspection.resizePanels')" class="w-1 shrink-0 bg-border transition-colors hover:bg-primary/30 focus-visible:bg-primary/30" />
      <SplitterPanel :default-size="100 - listSize" :min-size="20" class="min-h-0 min-w-0 overflow-auto p-2">
        <Button
          v-if="details"
          size="sm"
          variant="ghost"
          @click="attempt(() => session.seek(details!.sequence))"
        >
          {{ t('bundleInspection.goToRecord') }} {{ details.sequence }}
        </Button><SourceJsonTree v-if="details" :data="details" />
      </SplitterPanel>
    </SplitterGroup>
  </div>
</template>
