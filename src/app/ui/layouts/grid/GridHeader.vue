<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import GridNavUser from '@/app/ui/layouts/grid/GridNavUser.vue'
import { AppSwitcherContent } from '@/app/ui/layouts/shared'

const route = useRoute()
const isAdminRoute = computed(() => route.path.startsWith('/admin'))
</script>

<template>
  <div class="flex items-center gap-2">
    <AppSwitcherContent v-if="!isAdminRoute" />
    <div
      data-target="grid-layout-header-menu"
      class="flex h-full items-center"
    />
    <!--    <GridNavigationMenu :title="title" /> -->
  </div>

  <div class="flex-1" data-target="grid-layout-header" />

  <div class="flex-1 min-w-0" />

  <div data-target="grid-layout-header-actions" class="flex items-center" />
  <GridNavUser />
</template>
