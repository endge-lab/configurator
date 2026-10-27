<script setup lang="ts">
import type { GraphQLSchemaSourceKind } from '@/features/endge-ide/services/graphql-schema/graphql-schema-target'

import { Endge } from '@endge/core'
import { refDebounced } from '@vueuse/core'
import { Download, FileUp, Loader2, Network, Trash2, Type } from 'lucide-vue-next'
import { computed, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import { resolveGraphQLSchemaTarget } from '@/features/endge-ide/services/graphql-schema/graphql-schema-target'

const props = defineProps<{
  sourceKind: GraphQLSchemaSourceKind
  source: string
}>()

const { t, locale } = useI18n()
const fileInput = ref<HTMLInputElement | null>(null)
const debouncedSource = refDebounced(toRef(props, 'source'), 200)
const target = computed(() => resolveGraphQLSchemaTarget(Endge.source, props.sourceKind, debouncedSource.value))
const entry = computed(() => EndgeIDE.graphqlSchema.entryFor(target.value))
const loading = computed(() => EndgeIDE.graphqlSchema.isLoading(target.value))
const canUseEndpoint = computed(() => Boolean(target.value && !target.value.dynamicEndpoint && target.value.endpoint))
const statusText = computed(() => {
  if (!target.value?.endpoint && !target.value?.dynamicEndpoint) {
    return t('endgeIde.graphqlSchema.status.noEndpoint')
  }
  if (target.value.dynamicEndpoint) {
    return t('endgeIde.graphqlSchema.status.dynamicEndpoint')
  }
  return entry.value
    ? t('endgeIde.graphqlSchema.status.ready', { source: entry.value.sourceName })
    : t('endgeIde.graphqlSchema.status.none')
})
const detailsText = computed(() => entry.value
  ? t('endgeIde.graphqlSchema.status.details', {
      count: entry.value.typeCount,
      date: new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(entry.value.savedAt)),
    })
  : '')

async function loadFromEndpoint(): Promise<void> {
  const current = target.value
  if (!current) {
    return
  }
  await runLoad(() => EndgeIDE.graphqlSchema.loadFromEndpoint(current))
}

function chooseFile(): void {
  fileInput.value?.click()
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  const current = target.value
  if (input) {
    input.value = ''
  }
  if (!file || !current) {
    return
  }
  const text = await file.text()
  await runLoad(() => EndgeIDE.graphqlSchema.importText(current, text, file.name))
}

async function runLoad(operation: () => Promise<{ typeCount: number, persisted: boolean }>): Promise<void> {
  try {
    const result = await operation()
    toast.success(t('endgeIde.graphqlSchema.toast.loaded'), {
      description: result.persisted
        ? t('endgeIde.graphqlSchema.toast.loadedDescription', { count: result.typeCount })
        : t('endgeIde.graphqlSchema.status.memoryOnly'),
    })
  }
  catch (error) {
    toast.error(t('endgeIde.graphqlSchema.toast.loadFailed'), {
      description: error instanceof Error ? error.message : String(error),
    })
  }
}

function importTypes(): void {
  const current = entry.value
  if (!current) {
    return
  }
  EndgeIDE.documentImport.openSource('graphql', {
    source: current.text,
    fileName: current.sourceName,
    fileSize: current.text.length,
  })
}

async function removeSchema(): Promise<void> {
  const current = target.value
  if (!current) {
    return
  }
  await EndgeIDE.graphqlSchema.remove(current)
  toast.info(t('endgeIde.graphqlSchema.toast.removed'))
}
</script>

<template>
  <div v-if="target" class="flex items-center rounded-md border bg-muted/40 p-0.5">
    <input
      ref="fileInput"
      type="file"
      accept=".graphql,.gql,.graphqls,.json,text/plain,application/json"
      class="hidden"
      @change="onFileChange"
    >
    <DropdownMenu>
      <!--
        Без Tooltip вокруг триггера: TooltipTrigger — свой PopperRoot, и
        DropdownMenuTrigger внутри него регистрировал якорь не в меню, а в
        tooltip; меню открывалось вне экрана (translate -200%). Статус — в title
        и в заголовке меню.
      -->
      <DropdownMenuTrigger as-child>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="relative h-7 w-7"
          :aria-label="t('endgeIde.graphqlSchema.trigger')"
          :title="statusText"
          data-testid="graphql-schema-menu-trigger"
        >
          <Loader2 v-if="loading" class="size-4 animate-spin" />
          <Network v-else class="size-4" />
          <span
            v-if="entry"
            class="absolute right-1 top-1 size-1.5 rounded-full bg-primary"
            data-testid="graphql-schema-loaded-marker"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-72">
        <DropdownMenuLabel class="space-y-0.5">
          <div class="truncate text-sm" :title="statusText">
            {{ statusText }}
          </div>
          <div v-if="detailsText" class="text-xs font-normal text-muted-foreground">
            {{ detailsText }}
          </div>
          <div v-if="entry && !entry.persisted" class="text-xs font-normal text-muted-foreground">
            {{ t('endgeIde.graphqlSchema.status.memoryOnly') }}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem :disabled="!canUseEndpoint || loading" @select="loadFromEndpoint">
          <Download class="size-4" />
          {{ t('endgeIde.graphqlSchema.actions.loadEndpoint') }}
        </DropdownMenuItem>
        <DropdownMenuItem :disabled="!canUseEndpoint || loading" @select="chooseFile">
          <FileUp class="size-4" />
          {{ t('endgeIde.graphqlSchema.actions.loadFile') }}
        </DropdownMenuItem>
        <DropdownMenuItem :disabled="!entry" @select="importTypes">
          <Type class="size-4" />
          {{ t('endgeIde.graphqlSchema.actions.importTypes') }}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem :disabled="!entry" @select="removeSchema">
          <Trash2 class="size-4" />
          {{ t('endgeIde.graphqlSchema.actions.remove') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
