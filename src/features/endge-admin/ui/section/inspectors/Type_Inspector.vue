<script setup lang="ts">
import { computed } from 'vue'

import { Loader2 } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'

const props = defineProps<{
  tabContext?: { document?: { editor?: any } }
}>()

const editor = computed(() => props.tabContext?.document?.editor ?? null)

async function save(): Promise<void> {
  await EndgeAdmin.tabs.save()
}
</script>

<template>
  <div v-if="!editor" class="flex items-center justify-center h-full text-sm text-muted-foreground">
    Выберите документ
  </div>
  <div v-else class="flex flex-col h-full">
    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Название типа</label>
          <Input v-model="editor.name" />
        </div>
      </div>
    </ScrollArea>

    <div class="border-t p-4">
      <Button class="w-full" :disabled="EndgeAdmin.busy.value" @click="save">
        <Loader2 v-if="EndgeAdmin.busy.value" class="size-4 animate-spin mr-2" />
        {{ EndgeAdmin.busy.value ? 'Сохранение…' : 'Сохранить' }}
      </Button>
    </div>
  </div>
</template>
