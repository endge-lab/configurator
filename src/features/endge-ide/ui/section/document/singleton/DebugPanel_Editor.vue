<script setup lang="ts">
import { Bug } from 'lucide-vue-next'

// import TimelineDebug from '@/features/endge-admin/app/timeline-debug/TimelineDebug.vue'
</script>

<template>
  <div class="w-full h-full">
    <div class="p-5 flex flex-col gap-5 h-full min-h-0">
      <div class="flex items-center gap-3 min-w-0">
        <div class="size-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
          <Bug class="size-5 text-green-600" />
        </div>
        <div class="min-w-0">
          <div class="text-lg font-semibold truncate">
            Таймлайн журнала отладки
          </div>
        </div>
      </div>

      <div class="flex-1 min-h-0">
<!--        <TimelineDebug />-->
      </div>
    </div>
  </div>
</template>
