<script setup lang="ts">
import type { SidebarProps } from '@/shared/ui/sidebar'

import NavMain from '@/app/ui/layouts/main/NavMain.vue'
import {
  Sidebar,
  SidebarContent,
  SidebarRail,
} from '@/shared/ui/sidebar'

const props = withDefaults(defineProps<SidebarProps>(), {
  collapsible: 'offcanvas',
  variant: 'floating',
  side: 'left',

})
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarContent>
      <NavMain />
    </SidebarContent>
    <SidebarRail />
  </Sidebar>
</template>
