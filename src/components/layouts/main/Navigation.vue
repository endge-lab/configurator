<script setup lang="ts">
import type { SidebarProps } from '@/components/ui/sidebar'

import NavMain from '@/components/layouts/main/NavMain.vue'
import {
  Sidebar,
  SidebarContent,
  SidebarRail,
} from '@/components/ui/sidebar'

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
