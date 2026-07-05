<script setup lang="ts">
import { Endge } from '@endge/core'
import { computed } from 'vue'

import { Loader2 } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const props = defineProps<{
  tabContext?: { document?: { component?: any; previewModel?: any } }
}>()

const model = computed(() => props.tabContext?.document?.previewModel ?? props.tabContext?.document?.component ?? null)

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <div v-if="!model" class="flex items-center justify-center h-full text-sm text-muted-foreground">
    Выберите документ
  </div>
  <div v-else class="flex flex-col h-full">
    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Идентификатор параметра</label>
          <Input v-model="model.identity" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Название параметра</label>
          <Input v-model="model.displayName" />
        </div>
      </div>
    </ScrollArea>
    <div class="border-t p-4">
      <Button class="w-full" :disabled="EndgeIDE.busy.value" @click="save">
        <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin mr-2" />
        {{ EndgeIDE.busy.value ? 'Сохранение…' : 'Сохранить' }}
      </Button>
    </div>
  </div>
</template>
