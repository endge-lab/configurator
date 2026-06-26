<script setup lang="ts">
import { PanelTopClose } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'
import { showWidget } from '@/components/layouts/grid'
import DemonstrationContent from '@/features/endge-admin/ui/section/demonstration/DemonstrationContent.vue'

function moveToWidget(): void {
  EndgeAdmin.tabs.closeTab('demonstration')
  showWidget('demonstration')
}
</script>

<template>
  <div class="h-full flex flex-col min-h-0">
    <div class="flex items-center justify-end gap-1 px-2 py-1 border-b shrink-0">
      <Button
        variant="ghost"
        size="icon"
        class="size-8"
        title="Показать в виджете"
        @click="moveToWidget"
      >
        <PanelTopClose class="size-4" />
      </Button>
    </div>
    <div class="flex-1 min-h-0 overflow-hidden">
      <DemonstrationContent />
    </div>
  </div>
</template>
