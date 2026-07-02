<script setup lang="ts">
import { computed } from 'vue'

import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'

const model = computed<any>(() => EndgeAdmin.tabs.documentModel.value ?? null)
</script>

<template>
  <div class="p-3 text-sm space-y-3">
    <div class="flex items-center gap-2">
      <i class="ti ti-file-type-tsx text-cyan-500 text-xl" />
      <div class="font-medium truncate">
        {{ model?.displayName || model?.name || model?.identity || 'SFC' }}
      </div>
    </div>
    <div class="grid gap-2 text-xs text-muted-foreground">
      <div>identity: {{ model?.identity }}</div>
      <div>modelVersion: {{ model?.modelVersion ?? 1 }}</div>
      <div>targets: {{ (model?.supportedTargets ?? []).join(', ') }}</div>
      <div>source: {{ String(model?.source ?? '').length }} chars</div>
    </div>
  </div>
</template>
