<script setup lang="ts">
import { Endge } from '@endge/core'

import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Configurator } from '@/app/Configurator'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import SourceJsonTree from '@/features/endge-ide/ui/components/SourceJsonTree.vue'

const session = Configurator.remoteDebugger
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
const from = ref('')
const to = ref('')
const format = ref<'gzip' | 'json'>('gzip')
const exporting = ref(false)
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
async function download(range: boolean): Promise<void> {
  exporting.value = true
  try {
    if (
      range
      && (!from.value
        || !to.value
        || !Number.isSafeInteger(Number(from.value))
        || !Number.isSafeInteger(Number(to.value))
        || Number(from.value) > Number(to.value))
    ) {
      throw new Error('Укажите корректный диапазон записей')
    }
    await session.downloadRecording(
      format.value,
      range ? { from: Number(from.value), to: Number(to.value) } : undefined,
    )
  }
  finally {
    exporting.value = false
  }
}
function first(): void {
  const record = history.value.records[0]
  if (record) {
    session.seek(record.sequence)
  }
}
const { t } = useI18n()
</script>

<template>
  <div
    class="flex h-full min-h-0 flex-col overflow-auto text-xs"
    data-testid="inspection-history"
  >
    <div class="flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1">
      <Button
        variant="ghost"
        size="sm"
        :disabled="!history.records.length"
        @click="attempt(first)"
      >
        {{ t('bundleInspection.beginning') }}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :disabled="history.appliedSequence === history.records[0]?.sequence"
        @click="
          attempt(() => {
            session.pause();
            history.stepBackward();
          })
        "
      >
        {{ t('bundleInspection.previous') }}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :disabled="history.appliedSequence === history.receivedSequence"
        @click="
          attempt(() => {
            session.pause();
            history.setFollowLive(false);
            history.stepForward();
          })
        "
      >
        {{ t('bundleInspection.next') }}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :disabled="!history.records.length"
        @click="session.play()"
      >
        {{ session.playing.value ? t('bundleInspection.pause') : t('bundleInspection.play') }}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :disabled="history.receivedSequence === null"
        @click="attempt(() => session.seek(history.receivedSequence!))"
      >
        {{ t('bundleInspection.latest') }}
      </Button>
      <label class="mx-2 flex items-center gap-2"><Checkbox
        :model-value="history.followLive"
        @update:model-value="
          (value) =>
            attempt(() => {
              session.pause();
              history.setFollowLive(value === true);
            })
        "
      /> {{ t('bundleInspection.follow') }} </label>
      <span class="ml-auto tabular-nums text-muted-foreground"> {{ t('bundleInspection.viewing') }} {{ history.appliedSequence ?? "—" }} {{ t('bundleInspection.received') }} {{ history.receivedSequence ?? "—" }} {{ t('bundleInspection.separator') }} {{ history.records.length }} {{ t('bundleInspection.recordsSeparator') }} {{ (history.bytes / 1024).toFixed(1) }} {{ t('bundleInspection.sizeUnit') }} </span>
    </div>
    <div
      v-if="session.source.value === 'remote'"
      class="flex shrink-0 items-center gap-3 border-b px-3 py-1"
    >
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
    </div>
    <div
      v-if="history.records.length"
      class="flex shrink-0 items-center gap-3 px-3 py-2"
    >
      <input
        type="range"
        class="min-w-0 flex-1"
        min="0"
        :max="history.records.length - 1"
        :value="
          history.records.findIndex(
            (record) => record.sequence === history.appliedSequence,
          )
        "
        aria-label="Шаг истории"
        @input="
          (event) =>
            attempt(() =>
              session.seek(
                history.records[
                  Number((event.target as HTMLInputElement).value)
                ]!.sequence,
              ),
            )
        "
      >
      <span class="text-muted-foreground"> {{ t('bundleInspection.filterHelp') }} </span>
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
    <div class="grid min-h-40 flex-1 grid-cols-2 divide-x">
      <div class="flex min-h-0 flex-col">
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
      </div>
      <div class="min-h-0 overflow-auto p-2">
        <Button
          v-if="details"
          size="sm"
          variant="ghost"
          @click="attempt(() => session.seek(details!.sequence))"
        >
          {{ t('bundleInspection.goToRecord') }} {{ details.sequence }}
        </Button><SourceJsonTree v-if="details" :data="details" />
      </div>
    </div>
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-t p-2">
      <select
        v-model="format"
        aria-label="Формат экспорта истории"
        class="rounded border bg-background px-2 py-1"
      >
        <option value="gzip">
          {{ t('bundleInspection.gzip') }}
        </option>
        <option value="json">
          {{ t('bundleInspection.json') }}
        </option>
      </select>
      <Button
        variant="outline"
        size="sm"
        :disabled="!history.records.length || exporting"
        @click="attempt(() => download(false))"
      >
        {{ t('bundleInspection.exportAll') }}
      </Button>
      <Input
        v-model="from"
        type="number"
        placeholder="От"
        aria-label="Начало диапазона"
        class="h-7 w-24 text-xs"
      /><Input
        v-model="to"
        type="number"
        placeholder="До"
        aria-label="Конец диапазона"
        class="h-7 w-24 text-xs"
      />
      <Button
        variant="ghost"
        size="sm"
        :disabled="!history.records.length || exporting"
        @click="attempt(() => download(true))"
      >
        {{ t('bundleInspection.exportRange') }}
      </Button>
    </div>
  </div>
</template>
