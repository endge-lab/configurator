<script setup lang="ts">
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import LazyJsonNode from '@/features/endge-admin/ui/widgets/components/LazyJsonNode.vue'

const props = defineProps<{
  open: boolean
  title?: string
  data?: unknown
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const openModel = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

function close(): void {
  openModel.value = false
}
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent class="sm:max-w-[900px]">
      <DialogHeader>
        <DialogTitle>JSON словаря: {{ title || 'Словарь' }}</DialogTitle>
        <DialogDescription>Ленивый просмотр загруженных данных словаря из локального хранилища.</DialogDescription>
      </DialogHeader>

      <div class="rounded-md border">
        <ScrollArea class="h-[60vh] w-full">
          <div class="p-4">
            <LazyJsonNode :data="data ?? null" :chunk-size="100" />
          </div>
        </ScrollArea>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="close">
          Закрыть
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
