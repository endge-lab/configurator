<script setup lang="ts">
import { Endge } from '@endge/core'
import { CloudAlert, CloudUpload } from 'lucide-vue-next'
import { computed, onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const { t } = useI18n()
const open = ref(false)
const status = ref(Endge.context.getWorkspaceStateSyncStatus())
const off = Endge.context.subscribe(() => {
  status.value = Endge.context.getWorkspaceStateSyncStatus()
})
onScopeDispose(off)
const visible = computed(() => status.value.pending || status.value.error || status.value.conflicts.length)

async function resolve(key: string, action: 'retry' | 'discard'): Promise<void> {
  open.value = false
  await Endge.context.resolveWorkspaceStateConflict(key, action).catch(() => {})
}
</script>

<template>
  <Popover v-if="visible" v-model:open="open">
    <PopoverTrigger>
      <Button variant="ghost" size="icon" class="size-7" :aria-label="t('userSettings.syncTitle')" :title="t('userSettings.syncTitle')" :aria-expanded="open" @click="open = !open">
        <CloudAlert v-if="status.error || status.conflicts.length" class="size-4 text-destructive" />
        <CloudUpload v-else class="size-4" />
      </Button>
    </PopoverTrigger>
    <PopoverContent side="bottom" align="end" class="w-80 space-y-3">
      <h3 class="text-sm font-semibold">
        {{ t('userSettings.syncTitle') }}
      </h3>
      <p v-if="status.pending" class="text-sm">
        {{ t('userSettings.syncPending', { count: status.pending }) }}
      </p>
      <p v-if="status.error === 'network'" class="text-sm">
        {{ t('userSettings.syncNetwork') }}
      </p>
      <p v-if="status.error === 'session'" class="text-sm">
        {{ t('userSettings.syncSession') }}
      </p>
      <p v-if="status.error === 'storage'" class="text-sm">
        {{ t('userSettings.syncStorage') }}
      </p>
      <p v-if="status.conflicts.length" class="text-sm">
        {{ t('userSettings.syncConflict') }}
      </p>
      <ul v-if="status.conflicts.length" class="space-y-2">
        <li v-for="key in status.conflicts" :key="key" class="space-y-2 border-t pt-2">
          <code class="text-xs">{{ key }}</code>
          <div class="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" @click="resolve(key, 'retry')">
              {{ t('userSettings.syncRetry') }}
            </Button>
            <Button variant="ghost" size="sm" @click="resolve(key, 'discard')">
              {{ t('userSettings.syncDiscard') }}
            </Button>
          </div>
        </li>
      </ul>
    </PopoverContent>
  </Popover>
</template>
