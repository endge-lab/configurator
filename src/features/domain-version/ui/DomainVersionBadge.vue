<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text -- compact technical status labels */
import type { DomainVersionTargetState } from '@/features/domain-version/domain/types/domain-version.type'
import type { CSSProperties } from 'vue'

import { AlertTriangle, LoaderCircle, LockKeyhole, WifiOff } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<{
  state: DomainVersionTargetState
  prefix?: boolean
}>()

const cleanVersion = computed(() => {
  if (props.state.status !== 'ready' || props.state.value.state !== 'clean') {
    return ''
  }
  return props.state.value.domainVersion ?? ''
})
const label = computed(() => {
  if (props.state.status === 'idle' || props.state.status === 'loading') {
    return 'Загрузка…'
  }
  if (props.state.status === 'error') {
    if (props.state.code === 'unauthorized') {
      return 'Требуется вход'
    }
    if (props.state.code === 'forbidden') {
      return 'Нет доступа'
    }
    if (props.state.code === 'workspace_not_selected') {
      return 'Workspace не выбран'
    }
    if (props.state.code === 'unsupported') {
      return 'Без поддержки версий'
    }
    return 'Недоступно'
  }
  if (props.state.value.state === 'dirty') {
    return 'Есть изменения'
  }
  return shortVersion(cleanVersion.value) || 'Без версии'
})
const title = computed(() => {
  if (props.state.status === 'error') {
    return props.state.message
  }
  if (props.state.status !== 'ready') {
    return label.value
  }
  if (props.state.value.state === 'dirty') {
    return `${props.state.value.pendingRevisionCount} незакоммиченных revisions`
  }
  return [
    props.state.value.domainVersion,
    props.state.value.commitMessage,
    props.state.value.committedAt,
  ].filter(Boolean).join('\n')
})
const versionStyle = computed<CSSProperties>(() => {
  if (!cleanVersion.value) {
    return {}
  }
  const digest = cleanVersion.value.split(':').at(-1) ?? cleanVersion.value
  const hue = Number.parseInt(digest.slice(0, 8), 16) % 360
  return { '--domain-version-hue': String(hue) } as CSSProperties
})
const stateKind = computed(() => {
  if (props.state.status === 'ready') {
    return props.state.value.state === 'clean' ? 'version' : 'dirty'
  }
  if (props.state.status === 'error') {
    return props.state.code === 'unauthorized' || props.state.code === 'forbidden' ? 'locked' : 'error'
  }
  return 'loading'
})

function shortVersion(value: string): string {
  const digest = value.split(':').at(-1) ?? value
  return digest.slice(0, 12)
}
</script>

<template>
  <span
    class="domain-version-badge inline-flex h-5 max-w-48 items-center gap-1 rounded-md border px-2 font-mono text-[10px] font-semibold leading-none"
    :class="`domain-version-badge--${stateKind}`"
    :style="versionStyle"
    :title="title"
  >
    <LoaderCircle v-if="stateKind === 'loading'" class="size-3 animate-spin" />
    <AlertTriangle v-else-if="stateKind === 'dirty'" class="size-3" />
    <LockKeyhole v-else-if="stateKind === 'locked'" class="size-3" />
    <WifiOff v-else-if="stateKind === 'error'" class="size-3" />
    <span v-if="prefix" class="font-sans font-medium">Домен</span>
    <span class="truncate">{{ label }}</span>
  </span>
</template>

<style scoped>
.domain-version-badge--version {
  border-color: hsl(var(--domain-version-hue) 70% 45% / 35%);
  background: hsl(var(--domain-version-hue) 70% 45% / 12%);
  color: hsl(var(--domain-version-hue) 65% 31%);
}

:global(.dark) .domain-version-badge--version {
  border-color: hsl(var(--domain-version-hue) 70% 65% / 38%);
  background: hsl(var(--domain-version-hue) 70% 55% / 16%);
  color: hsl(var(--domain-version-hue) 72% 76%);
}

.domain-version-badge--dirty {
  border-color: rgb(245 158 11 / 35%);
  background: rgb(245 158 11 / 12%);
  color: rgb(180 83 9);
}

:global(.dark) .domain-version-badge--dirty {
  color: rgb(252 211 77);
}

.domain-version-badge--locked,
.domain-version-badge--error,
.domain-version-badge--loading {
  border-color: var(--border);
  background: color-mix(in srgb, var(--muted) 55%, transparent);
  color: var(--muted-foreground);
}
</style>
