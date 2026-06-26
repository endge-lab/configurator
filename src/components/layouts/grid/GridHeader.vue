<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import GridNavUser from '@/components/layouts/grid/GridNavUser.vue'
import { getLayoutState } from '@/components/layouts/grid/layout.ts'
import { AppSwitcherContent } from '@/components/layouts/shared'

const { title } = getLayoutState()
const route = useRoute()
const isAdminRoute = computed(() => route.path.startsWith('/admin'))
</script>

<template>
  <div class="flex items-center gap-2">
    <div
      v-if="isAdminRoute"
      data-target="grid-layout-header-environment"
      class="flex items-center"
    />
    <div
      v-if="isAdminRoute"
      data-target="grid-layout-header-locale"
      class="flex items-center"
    />
    <AppSwitcherContent v-else />
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
