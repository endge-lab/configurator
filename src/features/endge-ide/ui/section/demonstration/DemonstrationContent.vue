<script setup lang="ts">
import { computed } from 'vue'

import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'

const helpData = computed(() => EndgeIDE.demonstration.helpData.value)
const serialized = computed(() => JSON.stringify(helpData.value?.resultByKey ?? {}, null, 2))
</script>

<template>
  <div class="h-full w-full min-h-0 p-4 flex flex-col gap-3">
    <div>
      <div class="font-semibold">
        {{ $t('uiText.queryResultD3b0a5ce') }}
      </div>
      <div class="text-xs text-muted-foreground">
        {{ $t('uiText.textBc4bbe94') }}
      </div>
    </div>
    <pre class="flex-1 min-h-0 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">{{ serialized }}</pre>
  </div>
</template>
