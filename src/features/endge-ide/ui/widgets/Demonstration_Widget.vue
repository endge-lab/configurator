<script setup lang="ts">
import { PanelTopOpen } from 'lucide-vue-next'

import { hideWidget } from '@/components/layouts/grid'
import { Button } from '@/components/ui/button'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import DemonstrationContent from '@/features/endge-ide/ui/section/demonstration/DemonstrationContent.vue'

function moveToTab(): void {
  hideWidget('demonstration')
  EndgeIDE.tabs.openDemonstrationTab()
}
</script>

<template>
  <div class="h-full flex flex-col min-h-0">
    <div class="flex items-center justify-end shrink-0 px-1 py-0.5">
      <Button
        variant="ghost"
        size="icon"
        class="size-8"
        title="Показать во вкладке"
        @click="moveToTab"
      >
        <PanelTopOpen class="size-4" />
      </Button>
    </div>
    <div class="flex-1 min-h-0 overflow-hidden">
      <DemonstrationContent />
    </div>
  </div>
</template>
